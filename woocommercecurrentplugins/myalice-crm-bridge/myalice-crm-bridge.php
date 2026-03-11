<?php
/**
 * Plugin Name: MyAlice CRM Bridge
 * Description: Exposes SalesKing agent pricing rules and WooCommerce data for MyAlice CRM integration.
 * Version: 1.0.0
 * Author: MyAlice
 * Requires Plugins: woocommerce
 */

if (!defined('ABSPATH')) exit;

add_action('rest_api_init', function () {

    // ─── GET /wp-json/myalice-crm/v1/salesking-agent/{agent_id} ─────────────
    // Returns the agent's pricing rules: max discount, group, global settings
    register_rest_route('myalice-crm/v1', '/salesking-agent/(?P<agent_id>\d+)', [
        'methods'  => 'GET',
        'callback' => 'myalice_get_salesking_agent_rules',
        'permission_callback' => 'myalice_crm_check_wc_auth',
        'args' => [
            'agent_id' => [
                'required' => true,
                'validate_callback' => function ($param) {
                    return is_numeric($param);
                },
            ],
        ],
    ]);

    // ─── GET /wp-json/myalice-crm/v1/salesking-groups ───────────────────────
    // Returns all SalesKing agent groups with their discount limits
    register_rest_route('myalice-crm/v1', '/salesking-groups', [
        'methods'  => 'GET',
        'callback' => 'myalice_get_salesking_groups',
        'permission_callback' => 'myalice_crm_check_wc_auth',
    ]);

    // ─── GET /wp-json/myalice-crm/v1/salesking-settings ─────────────────────
    // Returns global SalesKing pricing settings
    register_rest_route('myalice-crm/v1', '/salesking-settings', [
        'methods'  => 'GET',
        'callback' => 'myalice_get_salesking_settings',
        'permission_callback' => 'myalice_crm_check_wc_auth',
    ]);

    // ─── GET /wp-json/myalice-crm/v1/salesking-rules ────────────────────────
    // Returns all SalesKing commission rules
    register_rest_route('myalice-crm/v1', '/salesking-rules', [
        'methods'  => 'GET',
        'callback' => 'myalice_get_salesking_commission_rules',
        'permission_callback' => 'myalice_crm_check_wc_auth',
    ]);
});

/**
 * Authenticate using WooCommerce consumer key/secret (Basic Auth).
 * This allows our CRM to reuse the same WC_KEY/WC_SECRET credentials.
 */
function myalice_crm_check_wc_auth(WP_REST_Request $request) {
    // Check for Basic Auth header
    $auth_header = $request->get_header('Authorization');
    if (!$auth_header || stripos($auth_header, 'Basic ') !== 0) {
        return new WP_Error('rest_forbidden', 'Authentication required', ['status' => 401]);
    }

    $credentials = base64_decode(substr($auth_header, 6));
    if (!$credentials || strpos($credentials, ':') === false) {
        return new WP_Error('rest_forbidden', 'Invalid credentials', ['status' => 401]);
    }

    list($consumer_key, $consumer_secret) = explode(':', $credentials, 2);

    // Validate against WooCommerce API keys table
    global $wpdb;
    $key = $wpdb->get_row($wpdb->prepare(
        "SELECT consumer_secret, permissions FROM {$wpdb->prefix}woocommerce_api_keys WHERE consumer_key = %s",
        wc_api_hash($consumer_key)
    ));

    if (!$key || !hash_equals($key->consumer_secret, $consumer_secret)) {
        return new WP_Error('rest_forbidden', 'Invalid API key', ['status' => 401]);
    }

    return true;
}

/**
 * GET /salesking-agent/{agent_id}
 * Returns agent's pricing rules, group, max discount, and computed limits.
 */
function myalice_get_salesking_agent_rules(WP_REST_Request $request) {
    $agent_id = intval($request['agent_id']);

    // Check user exists and is an agent
    $user = get_user_by('ID', $agent_id);
    if (!$user) {
        return new WP_Error('not_found', 'Agent not found', ['status' => 404]);
    }

    $user_choice = get_user_meta($agent_id, 'salesking_user_choice', true);

    // Agent's group
    $group_id = get_user_meta($agent_id, 'salesking_group', true);
    $group_name = '';
    $group_max_discount = 0;

    if ($group_id) {
        $group_post = get_post($group_id);
        if ($group_post) {
            $group_name = $group_post->post_title;
            $group_max_discount = floatval(get_post_meta($group_id, 'salesking_group_max_discount', true));
        }
    }

    // Agent's individual max discount (overrides group)
    $agent_max_discount = get_user_meta($agent_id, 'salesking_group_max_discount', true);

    // Effective max discount: agent-level > group-level > default 1%
    $effective_max_discount = 1; // default
    if (!empty($agent_max_discount) && floatval($agent_max_discount) > 0) {
        $effective_max_discount = floatval($agent_max_discount);
    } elseif ($group_max_discount > 0) {
        $effective_max_discount = $group_max_discount;
    }

    // Global settings
    $can_increase = intval(get_option('salesking_agents_can_edit_prices_increase_setting', 1));
    $can_decrease = intval(get_option('salesking_agents_can_edit_prices_discounts_setting', 1));
    $discount_from_commission = intval(get_option('salesking_take_out_discount_agent_commission_setting', 0));

    // Parent agent (for hierarchical teams)
    $parent_agent = get_user_meta($agent_id, 'salesking_parent_agent', true);

    // Assigned customers
    $assigned_customers_query = get_users([
        'meta_key'   => 'salesking_assigned_agent',
        'meta_value' => $agent_id,
        'fields'     => 'ID',
        'number'     => 0,
    ]);

    return rest_ensure_response([
        'agent_id'              => $agent_id,
        'display_name'          => $user->display_name,
        'email'                 => $user->user_email,
        'user_choice'           => $user_choice,
        'roles'                 => $user->roles,

        // Group info
        'group' => [
            'id'            => $group_id ? intval($group_id) : null,
            'name'          => $group_name,
            'max_discount'  => $group_max_discount,
        ],

        // Pricing rules
        'pricing' => [
            'agent_max_discount'     => !empty($agent_max_discount) ? floatval($agent_max_discount) : null,
            'effective_max_discount' => $effective_max_discount,
            'can_increase_price'     => (bool) $can_increase,
            'can_decrease_price'     => (bool) $can_decrease,
            'discount_from_commission' => (bool) $discount_from_commission,
        ],

        // Team info
        'parent_agent'        => $parent_agent ? intval($parent_agent) : null,
        'assigned_customers'  => count($assigned_customers_query),
    ]);
}

/**
 * GET /salesking-groups
 * Returns all SalesKing agent groups with their settings.
 */
function myalice_get_salesking_groups(WP_REST_Request $request) {
    $groups = get_posts([
        'post_type'   => 'salesking_group',
        'numberposts' => -1,
        'post_status' => 'publish',
    ]);

    $result = [];
    foreach ($groups as $group) {
        $max_discount = get_post_meta($group->ID, 'salesking_group_max_discount', true);

        // Count agents in this group
        $agents_in_group = get_users([
            'meta_key'   => 'salesking_group',
            'meta_value' => $group->ID,
            'fields'     => 'ID',
            'number'     => 0,
        ]);

        $result[] = [
            'id'            => $group->ID,
            'name'          => $group->post_title,
            'max_discount'  => $max_discount ? floatval($max_discount) : 0,
            'agent_count'   => count($agents_in_group),
        ];
    }

    return rest_ensure_response(['groups' => $result]);
}

/**
 * GET /salesking-settings
 * Returns global SalesKing settings relevant to pricing.
 */
function myalice_get_salesking_settings(WP_REST_Request $request) {
    return rest_ensure_response([
        'can_edit_prices_increase'  => intval(get_option('salesking_agents_can_edit_prices_increase_setting', 1)),
        'can_edit_prices_discount'  => intval(get_option('salesking_agents_can_edit_prices_discounts_setting', 1)),
        'discount_from_commission'  => intval(get_option('salesking_take_out_discount_agent_commission_setting', 0)),
        'different_commission_increase' => intval(get_option('salesking_different_commission_price_increase_setting', 0)),
        'agents_can_manage_orders'  => intval(get_option('salesking_agents_can_manage_orders_setting', 0)),
        'agents_can_edit_customers' => intval(get_option('salesking_agents_can_edit_customers_setting', 0)),
    ]);
}

/**
 * GET /salesking-rules
 * Returns all SalesKing commission rules.
 */
function myalice_get_salesking_commission_rules(WP_REST_Request $request) {
    $rules = get_posts([
        'post_type'   => 'salesking_rule',
        'numberposts' => -1,
        'post_status' => 'publish',
    ]);

    $result = [];
    foreach ($rules as $rule) {
        $meta = get_post_meta($rule->ID);
        $rule_data = [
            'id'    => $rule->ID,
            'title' => $rule->post_title,
        ];

        // Include all salesking-prefixed meta
        foreach ($meta as $key => $values) {
            if (strpos($key, 'salesking_') === 0) {
                $rule_data[$key] = count($values) === 1 ? $values[0] : $values;
            }
        }

        $result[] = $rule_data;
    }

    return rest_ensure_response(['rules' => $result]);
}
