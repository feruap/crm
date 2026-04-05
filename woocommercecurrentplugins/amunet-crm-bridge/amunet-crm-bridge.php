<?php
/**
 * Plugin Name: Amunet CRM Bridge
 * Description: Unified bridge between Amunet CRM and WooCommerce. Exposes SalesKing agent rules, B2BKing pricing, visitor tracking, and order data via REST API.
 * Version: 2.1.0
 * Author: Amunet
 * Requires Plugins: woocommerce
 * Text Domain: amunet-crm-bridge
 */

if (!defined('ABSPATH')) exit;

define('AMUNET_CRM_BRIDGE_VERSION', '2.1.0');

// ═══════════════════════════════════════════════════════════════════════════
// ACTIVATION: Create visitor tracking table
// ═══════════════════════════════════════════════════════════════════════════

register_activation_hook(__FILE__, function () {
    global $wpdb;
    $table = $wpdb->prefix . 'amunet_visitors';
    $charset = $wpdb->get_charset_collate();
    $sql = "CREATE TABLE IF NOT EXISTS $table (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        cookie_id VARCHAR(50) NOT NULL,
        phone VARCHAR(30) DEFAULT NULL,
        utm_source VARCHAR(100) DEFAULT '',
        utm_medium VARCHAR(100) DEFAULT '',
        utm_campaign VARCHAR(200) DEFAULT '',
        utm_content VARCHAR(200) DEFAULT '',
        utm_term VARCHAR(200) DEFAULT '',
        products_visited TEXT DEFAULT NULL,
        pages TEXT DEFAULT NULL,
        referrer VARCHAR(500) DEFAULT '',
        landing_page VARCHAR(500) DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY cookie_id (cookie_id),
        KEY phone (phone),
        KEY utm_campaign (utm_campaign)
    ) $charset;";
    require_once ABSPATH . 'wp-admin/includes/upgrade.php';
    dbDelta($sql);
});

// ═══════════════════════════════════════════════════════════════════════════
// FRONTEND: Enqueue visitor tracker script
// ═══════════════════════════════════════════════════════════════════════════

add_action('wp_enqueue_scripts', function () {
    wp_enqueue_script('amunet-tracker', plugin_dir_url(__FILE__) . 'js/tracker.js', [], AMUNET_CRM_BRIDGE_VERSION, true);
    wp_localize_script('amunet-tracker', 'amunetTrackerConfig', [
        'apiUrl' => rest_url('amunet-crm/v1'),
        'nonce'  => wp_create_nonce('wp_rest'),
    ]);
});

// ═══════════════════════════════════════════════════════════════════════════
// BYPASS WP AUTH FOR WC API KEYS ON OUR NAMESPACE
// WordPress Application Passwords intercepts Basic Auth and rejects WC API
// keys (ck_*) as invalid usernames. We clear the error for our namespace
// so our permission_callback can handle auth properly.
// ═══════════════════════════════════════════════════════════════════════════

add_filter('rest_authentication_errors', function ($error) {
    if ($error === null) {
        return $error; // No error, nothing to fix
    }
    // Only intervene on our namespace
    $route = isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '';
    if (strpos($route, 'amunet-crm/v1') === false) {
        return $error; // Not our route
    }
    // Only clear if Basic Auth user looks like a WC API key
    $auth_user = isset($_SERVER['PHP_AUTH_USER']) ? $_SERVER['PHP_AUTH_USER'] : '';
    if (strpos($auth_user, 'ck_') === 0) {
        return null; // Clear WP auth error, let permission_callback handle it
    }
    return $error;
}, 99);

// ═══════════════════════════════════════════════════════════════════════════
// REST API ROUTES
// ═══════════════════════════════════════════════════════════════════════════

add_action('rest_api_init', function () {

    $ns = 'amunet-crm/v1';

    // ── SalesKing Endpoints (WC Auth required) ──────────────────────────

    register_rest_route($ns, '/salesking-agent/(?P<agent_id>\d+)', [
        'methods'             => 'GET',
        'callback'            => 'amunet_get_salesking_agent_rules',
        'permission_callback' => 'amunet_crm_check_wc_auth',
        'args' => ['agent_id' => ['required' => true, 'validate_callback' => function($v) { return is_numeric($v); }]],
    ]);

    register_rest_route($ns, '/salesking-groups', [
        'methods'             => 'GET',
        'callback'            => 'amunet_get_salesking_groups',
        'permission_callback' => 'amunet_crm_check_wc_auth',
    ]);

    register_rest_route($ns, '/salesking-settings', [
        'methods'             => 'GET',
        'callback'            => 'amunet_get_salesking_settings',
        'permission_callback' => 'amunet_crm_check_wc_auth',
    ]);

    register_rest_route($ns, '/salesking-rules', [
        'methods'             => 'GET',
        'callback'            => 'amunet_get_salesking_commission_rules',
        'permission_callback' => 'amunet_crm_check_wc_auth',
    ]);

    // ── SalesKing Agent Sync Endpoints (WC Auth required) ──────────────────

    register_rest_route($ns, '/salesking-agents', [
        'methods'             => 'GET',
        'callback'            => 'amunet_list_salesking_agents',
        'permission_callback' => 'amunet_crm_check_wc_auth',
    ]);

    register_rest_route($ns, '/users', [
        'methods'             => 'POST',
        'callback'            => 'amunet_create_wp_user',
        'permission_callback' => 'amunet_crm_check_wc_auth',
    ]);

    register_rest_route($ns, '/users/(?P<user_id>\d+)', [
        'methods'             => 'PUT',
        'callback'            => 'amunet_update_wp_user',
        'permission_callback' => 'amunet_crm_check_wc_auth',
        'args' => ['user_id' => ['required' => true, 'validate_callback' => function($v) { return is_numeric($v); }]],
    ]);

    // ── B2BKing Endpoints (WC Auth required) ────────────────────────────

    register_rest_route($ns, '/b2bking-pricing/(?P<product_id>\d+)', [
        'methods'             => 'GET',
        'callback'            => 'amunet_get_b2bking_pricing',
        'permission_callback' => 'amunet_crm_check_wc_auth',
        'args' => ['product_id' => ['required' => true, 'validate_callback' => function($v) { return is_numeric($v); }]],
    ]);

    register_rest_route($ns, '/b2bking-customer/(?P<customer_id>\d+)', [
        'methods'             => 'GET',
        'callback'            => 'amunet_get_b2bking_customer',
        'permission_callback' => 'amunet_crm_check_wc_auth',
        'args' => ['customer_id' => ['required' => true, 'validate_callback' => function($v) { return is_numeric($v); }]],
    ]);

    register_rest_route($ns, '/b2bking-groups', [
        'methods'             => 'GET',
        'callback'            => 'amunet_get_b2bking_groups',
        'permission_callback' => 'amunet_crm_check_wc_auth',
    ]);

    // ── Order Tracking Endpoint (WC Auth required) ──────────────────────

    register_rest_route($ns, '/order-tracking/(?P<order_id>\d+)', [
        'methods'             => 'GET',
        'callback'            => 'amunet_get_order_tracking',
        'permission_callback' => 'amunet_crm_check_wc_auth',
        'args' => ['order_id' => ['required' => true, 'validate_callback' => function($v) { return is_numeric($v); }]],
    ]);

    // ── Payment Methods Endpoint (WC Auth required) ─────────────────────

    register_rest_route($ns, '/payment-methods', [
        'methods'             => 'GET',
        'callback'            => 'amunet_get_payment_methods',
        'permission_callback' => 'amunet_crm_check_wc_auth',
    ]);

    // ── Shipping Zones Endpoint (WC Auth required) ──────────────────────

    register_rest_route($ns, '/shipping-zones', [
        'methods'             => 'GET',
        'callback'            => 'amunet_get_shipping_zones',
        'permission_callback' => 'amunet_crm_check_wc_auth',
    ]);

    // ── Visitor Tracker Endpoints (nonce or API key auth) ───────────────

    register_rest_route($ns, '/track', [
        'methods'             => 'POST',
        'callback'            => 'amunet_tracker_save',
        'permission_callback' => 'amunet_tracker_check_auth',
    ]);

    register_rest_route($ns, '/visitor/(?P<phone>[0-9]+)', [
        'methods'             => 'GET',
        'callback'            => 'amunet_tracker_get_by_phone',
        'permission_callback' => 'amunet_crm_check_wc_or_nonce',
    ]);

    register_rest_route($ns, '/visitor-by-cookie/(?P<cookie_id>[a-zA-Z0-9_]+)', [
        'methods'             => 'GET',
        'callback'            => 'amunet_tracker_get_by_cookie',
        'permission_callback' => 'amunet_crm_check_wc_or_nonce',
    ]);

    register_rest_route($ns, '/link-phone', [
        'methods'             => 'POST',
        'callback'            => 'amunet_tracker_link_phone',
        'permission_callback' => 'amunet_crm_check_wc_or_nonce',
    ]);

    // ── Health Check ────────────────────────────────────────────────────

    register_rest_route($ns, '/health', [
        'methods'             => 'GET',
        'callback'            => function () {
            return rest_ensure_response([
                'status'  => 'ok',
                'version' => AMUNET_CRM_BRIDGE_VERSION,
                'salesking_active' => class_exists('Salesking') || defined('SALESKING_DIR'),
                'b2bking_active'   => class_exists('B2bking') || defined('B2BKING_DIR'),
                'wc_version'       => defined('WC_VERSION') ? WC_VERSION : 'not found',
            ]);
        },
        'permission_callback' => '__return_true',
    ]);
});

// ═══════════════════════════════════════════════════════════════════════════
// AUTHENTICATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * WooCommerce API Key authentication (Basic Auth).
 * Used for CRM server-to-server calls.
 */
function amunet_crm_check_wc_auth(WP_REST_Request $request) {
    $consumer_key = '';
    $consumer_secret = '';

    // Method 1: Query parameters (like WooCommerce's own API)
    $ck = $request->get_param('consumer_key');
    $cs = $request->get_param('consumer_secret');
    if ($ck && $cs) {
        $consumer_key = $ck;
        $consumer_secret = $cs;
    }
    // Method 2: PHP_AUTH_USER/PW (set by Apache/PHP from Basic Auth)
    elseif (!empty($_SERVER['PHP_AUTH_USER']) && !empty($_SERVER['PHP_AUTH_PW'])) {
        $consumer_key = $_SERVER['PHP_AUTH_USER'];
        $consumer_secret = $_SERVER['PHP_AUTH_PW'];
    }
    // Method 3: Authorization header (manual parsing)
    else {
        $auth_header = $request->get_header('Authorization');
        if (!$auth_header || stripos($auth_header, 'Basic ') !== 0) {
            return new WP_Error('rest_forbidden', 'Authentication required', ['status' => 401]);
        }
        $credentials = base64_decode(substr($auth_header, 6));
        if (!$credentials || strpos($credentials, ':') === false) {
            return new WP_Error('rest_forbidden', 'Invalid credentials', ['status' => 401]);
        }
        list($consumer_key, $consumer_secret) = explode(':', $credentials, 2);
    }

    if (empty($consumer_key) || empty($consumer_secret)) {
        return new WP_Error('rest_forbidden', 'Authentication required', ['status' => 401]);
    }
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
 * Tracker POST auth: accepts WP nonce (frontend) or WC API key (CRM).
 */
function amunet_tracker_check_auth(WP_REST_Request $request) {
    // Allow nonce auth (from frontend JS)
    if (wp_verify_nonce($request->get_header('X-WP-Nonce'), 'wp_rest')) {
        return true;
    }
    // Allow WC auth (from CRM) - Basic Auth or query params
    if ($request->get_param('consumer_key') ||
        !empty($_SERVER['PHP_AUTH_USER']) ||
        ($request->get_header('Authorization') && stripos($request->get_header('Authorization'), 'Basic ') === 0)) {
        return amunet_crm_check_wc_auth($request);
    }
    // Fallback: allow unauthenticated tracking POSTs (public visitor tracking)
    return true;
}

/**
 * Read endpoints: WC auth OR nonce.
 */
function amunet_crm_check_wc_or_nonce(WP_REST_Request $request) {
    if (wp_verify_nonce($request->get_header('X-WP-Nonce'), 'wp_rest')) return true;
    // WC auth via query params, PHP_AUTH, or Authorization header
    if ($request->get_param('consumer_key') ||
        !empty($_SERVER['PHP_AUTH_USER']) ||
        ($request->get_header('Authorization') && stripos($request->get_header('Authorization'), 'Basic ') === 0)) {
        return amunet_crm_check_wc_auth($request);
    }
    return new WP_Error('rest_forbidden', 'Authentication required', ['status' => 401]);
}

// ═══════════════════════════════════════════════════════════════════════════
// SALESKING ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

function amunet_get_salesking_agent_rules(WP_REST_Request $request) {
    $agent_id = intval($request['agent_id']);
    $user = get_user_by('ID', $agent_id);
    if (!$user) return new WP_Error('not_found', 'Agent not found', ['status' => 404]);

    $user_choice = get_user_meta($agent_id, 'salesking_user_choice', true);
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

    $agent_max_discount = get_user_meta($agent_id, 'salesking_group_max_discount', true);
    $effective_max_discount = 1;
    if (!empty($agent_max_discount) && floatval($agent_max_discount) > 0) {
        $effective_max_discount = floatval($agent_max_discount);
    } elseif ($group_max_discount > 0) {
        $effective_max_discount = $group_max_discount;
    }

    $can_increase = intval(get_option('salesking_agents_can_edit_prices_increase_setting', 1));
    $can_decrease = intval(get_option('salesking_agents_can_edit_prices_discounts_setting', 1));
    $discount_from_commission = intval(get_option('salesking_take_out_discount_agent_commission_setting', 0));
    $parent_agent = get_user_meta($agent_id, 'salesking_parent_agent', true);

    $assigned_customers = get_users([
        'meta_key' => 'salesking_assigned_agent', 'meta_value' => $agent_id,
        'fields' => 'ID', 'number' => 0,
    ]);

    // SalesKing earnings
    $earnings = [
        'total'       => floatval(get_user_meta($agent_id, 'salesking_earnings', true) ?: 0),
        'outstanding' => floatval(get_user_meta($agent_id, 'salesking_outstanding_earnings', true) ?: 0),
        'paid'        => floatval(get_user_meta($agent_id, 'salesking_paid_earnings', true) ?: 0),
    ];

    return rest_ensure_response([
        'agent_id'     => $agent_id,
        'display_name' => $user->display_name,
        'email'        => $user->user_email,
        'user_choice'  => $user_choice,
        'roles'        => $user->roles,
        'group' => [
            'id' => $group_id ? intval($group_id) : null,
            'name' => $group_name,
            'max_discount' => $group_max_discount,
        ],
        'pricing' => [
            'agent_max_discount'     => !empty($agent_max_discount) ? floatval($agent_max_discount) : null,
            'effective_max_discount' => $effective_max_discount,
            'can_increase_price'     => (bool)$can_increase,
            'can_decrease_price'     => (bool)$can_decrease,
            'discount_from_commission' => (bool)$discount_from_commission,
        ],
        'earnings'           => $earnings,
        'parent_agent'       => $parent_agent ? intval($parent_agent) : null,
        'assigned_customers' => count($assigned_customers),
    ]);
}

function amunet_get_salesking_groups(WP_REST_Request $request) {
    $groups = get_posts(['post_type' => 'salesking_group', 'numberposts' => -1, 'post_status' => 'publish']);
    $result = [];
    foreach ($groups as $group) {
        $max_discount = get_post_meta($group->ID, 'salesking_group_max_discount', true);
        $agents = get_users(['meta_key' => 'salesking_group', 'meta_value' => $group->ID, 'fields' => 'ID', 'number' => 0]);
        $result[] = [
            'id' => $group->ID, 'name' => $group->post_title,
            'max_discount' => $max_discount ? floatval($max_discount) : 0,
            'agent_count' => count($agents),
        ];
    }
    return rest_ensure_response(['groups' => $result]);
}

function amunet_get_salesking_settings(WP_REST_Request $request) {
    return rest_ensure_response([
        'can_edit_prices_increase'      => intval(get_option('salesking_agents_can_edit_prices_increase_setting', 1)),
        'can_edit_prices_discount'      => intval(get_option('salesking_agents_can_edit_prices_discounts_setting', 1)),
        'discount_from_commission'      => intval(get_option('salesking_take_out_discount_agent_commission_setting', 0)),
        'different_commission_increase' => intval(get_option('salesking_different_commission_price_increase_setting', 0)),
        'agents_can_manage_orders'      => intval(get_option('salesking_agents_can_manage_orders_setting', 0)),
        'agents_can_edit_customers'     => intval(get_option('salesking_agents_can_edit_customers_setting', 0)),
    ]);
}

function amunet_get_salesking_commission_rules(WP_REST_Request $request) {
    $rules = get_posts(['post_type' => 'salesking_rule', 'numberposts' => -1, 'post_status' => 'publish']);
    $result = [];
    foreach ($rules as $rule) {
        $meta = get_post_meta($rule->ID);
        $rule_data = ['id' => $rule->ID, 'title' => $rule->post_title];
        foreach ($meta as $key => $values) {
            if (strpos($key, 'salesking_') === 0) {
                $rule_data[$key] = count($values) === 1 ? $values[0] : $values;
            }
        }
        $result[] = $rule_data;
    }
    return rest_ensure_response(['rules' => $result]);
}

// ═══════════════════════════════════════════════════════════════════════════
// SALESKING AGENT SYNC ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /salesking-agents
 * Lists ALL WordPress users that have SalesKing agent roles.
 * Used by CRM to import/sync agents.
 */
function amunet_list_salesking_agents(WP_REST_Request $request) {
    // SalesKing agents can have role "agent" (Agente Local) or "shop_manager" (Manager)
    // Also check "administrator" since some admins are agents too
    $agent_roles = ['agent', 'shop_manager', 'administrator'];

    $all_agents = [];
    foreach ($agent_roles as $role) {
        $users = get_users(['role' => $role, 'number' => 0]);
        foreach ($users as $user) {
            // Skip if already added (user might have multiple roles)
            if (isset($all_agents[$user->ID])) continue;

            // Check if user has SalesKing agent data
            $agentid = get_user_meta($user->ID, 'salesking_agentid', true);
            $group_id = get_user_meta($user->ID, 'salesking_group', true);
            $parent_agent = get_user_meta($user->ID, 'salesking_parent_agent', true);
            $user_choice = get_user_meta($user->ID, 'salesking_user_choice', true);

            $group_name = '';
            if ($group_id) {
                $group_post = get_post($group_id);
                if ($group_post) $group_name = $group_post->post_title;
            }

            // Determine account type from SalesKing
            $account_type = 'agent'; // default
            if (in_array('shop_manager', $user->roles) || in_array('administrator', $user->roles)) {
                $account_type = 'manager';
            }

            // Parent agent name
            $parent_name = '';
            if ($parent_agent) {
                $parent_user = get_user_by('ID', $parent_agent);
                if ($parent_user) $parent_name = $parent_user->display_name;
            }

            // Earnings
            $earnings = [
                'total'       => floatval(get_user_meta($user->ID, 'salesking_earnings', true) ?: 0),
                'outstanding' => floatval(get_user_meta($user->ID, 'salesking_outstanding_earnings', true) ?: 0),
                'paid'        => floatval(get_user_meta($user->ID, 'salesking_paid_earnings', true) ?: 0),
            ];

            $all_agents[$user->ID] = [
                'wp_user_id'    => $user->ID,
                'username'      => $user->user_login,
                'display_name'  => $user->display_name,
                'email'         => $user->user_email,
                'roles'         => array_values($user->roles),
                'salesking_agentid' => $agentid ?: null,
                'group' => [
                    'id'   => $group_id ? intval($group_id) : null,
                    'name' => $group_name,
                ],
                'account_type'  => $account_type,
                'parent_agent'  => $parent_agent ? intval($parent_agent) : null,
                'parent_name'   => $parent_name,
                'earnings'      => $earnings,
                'registered'    => $user->user_registered,
            ];
        }
    }

    return rest_ensure_response([
        'agents' => array_values($all_agents),
        'total'  => count($all_agents),
    ]);
}

/**
 * POST /users
 * Creates a WordPress user and sets SalesKing metadata.
 * CRM role mapping: agent -> WP role "agent", supervisor -> "shop_manager", admin -> "administrator"
 */
function amunet_create_wp_user(WP_REST_Request $request) {
    $params = $request->get_json_params();

    $username     = sanitize_user($params['username'] ?? '');
    $email        = sanitize_email($params['email'] ?? '');
    $display_name = sanitize_text_field($params['display_name'] ?? '');
    $password     = $params['password'] ?? wp_generate_password(16);
    $crm_role     = sanitize_text_field($params['crm_role'] ?? 'agent');
    $group_id     = intval($params['salesking_group_id'] ?? 0);
    $parent_agent = intval($params['parent_agent_id'] ?? 0);

    if (empty($username) || empty($email)) {
        return new WP_Error('missing_fields', 'username and email are required', ['status' => 400]);
    }

    // Map CRM role to WP role
    $role_map = [
        'agent'      => 'agent',
        'supervisor' => 'shop_manager',
        'admin'      => 'administrator',
    ];
    $wp_role = $role_map[$crm_role] ?? 'agent';

    // Check if user already exists
    if (username_exists($username)) {
        return new WP_Error('user_exists', 'Username already exists', ['status' => 409]);
    }
    if (email_exists($email)) {
        return new WP_Error('email_exists', 'Email already exists', ['status' => 409]);
    }

    // Create the user
    $user_id = wp_insert_user([
        'user_login'   => $username,
        'user_email'   => $email,
        'user_pass'    => $password,
        'display_name' => $display_name ?: $username,
        'role'         => $wp_role,
    ]);

    if (is_wp_error($user_id)) {
        return new WP_Error('create_failed', $user_id->get_error_message(), ['status' => 500]);
    }

    // Set SalesKing metadata
    // SalesKing expects salesking_user_choice to be set for agents
    if ($wp_role === 'agent' || $wp_role === 'shop_manager') {
        update_user_meta($user_id, 'salesking_user_choice', 'agent');
    }

    if ($group_id > 0) {
        update_user_meta($user_id, 'salesking_group', $group_id);
    }

    if ($parent_agent > 0) {
        update_user_meta($user_id, 'salesking_parent_agent', $parent_agent);
    }

    // Initialize earnings
    update_user_meta($user_id, 'salesking_earnings', '0');
    update_user_meta($user_id, 'salesking_outstanding_earnings', '0');
    update_user_meta($user_id, 'salesking_paid_earnings', '0');

    // Get the generated SalesKing agent ID (if SalesKing auto-generates it)
    $agentid = get_user_meta($user_id, 'salesking_agentid', true);

    return rest_ensure_response([
        'wp_user_id'        => $user_id,
        'username'          => $username,
        'email'             => $email,
        'display_name'      => $display_name ?: $username,
        'role'              => $wp_role,
        'salesking_agentid' => $agentid ?: null,
    ]);
}

/**
 * PUT /users/{user_id}
 * Updates WordPress user fields and SalesKing metadata.
 */
function amunet_update_wp_user(WP_REST_Request $request) {
    $user_id = intval($request['user_id']);
    $user = get_user_by('ID', $user_id);
    if (!$user) return new WP_Error('not_found', 'User not found', ['status' => 404]);

    $params = $request->get_json_params();

    // Update basic user fields
    $update_data = ['ID' => $user_id];
    if (isset($params['display_name'])) $update_data['display_name'] = sanitize_text_field($params['display_name']);
    if (isset($params['email'])) $update_data['user_email'] = sanitize_email($params['email']);

    if (count($update_data) > 1) {
        $result = wp_update_user($update_data);
        if (is_wp_error($result)) {
            return new WP_Error('update_failed', $result->get_error_message(), ['status' => 500]);
        }
    }

    // Update role if specified
    if (isset($params['crm_role'])) {
        $role_map = [
            'agent'      => 'agent',
            'supervisor' => 'shop_manager',
            'admin'      => 'administrator',
        ];
        $new_role = $role_map[$params['crm_role']] ?? null;
        if ($new_role) {
            $user->set_role($new_role);
        }
    }

    // Update SalesKing metadata
    if (isset($params['salesking_group_id'])) {
        $gid = intval($params['salesking_group_id']);
        if ($gid > 0) {
            update_user_meta($user_id, 'salesking_group', $gid);
        } else {
            delete_user_meta($user_id, 'salesking_group');
        }
    }

    if (isset($params['parent_agent_id'])) {
        $pid = intval($params['parent_agent_id']);
        if ($pid > 0) {
            update_user_meta($user_id, 'salesking_parent_agent', $pid);
        } else {
            delete_user_meta($user_id, 'salesking_parent_agent');
        }
    }

    if (isset($params['is_active'])) {
        // We can't truly deactivate WP users, but we can update a meta flag
        update_user_meta($user_id, 'amunet_crm_active', $params['is_active'] ? '1' : '0');
    }

    // Refresh user data
    $user = get_user_by('ID', $user_id);
    $agentid = get_user_meta($user_id, 'salesking_agentid', true);

    return rest_ensure_response([
        'wp_user_id'        => $user_id,
        'username'          => $user->user_login,
        'email'             => $user->user_email,
        'display_name'      => $user->display_name,
        'roles'             => array_values($user->roles),
        'salesking_agentid' => $agentid ?: null,
        'updated'           => true,
    ]);
}

// ═══════════════════════════════════════════════════════════════════════════
// B2BKING ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /b2bking-pricing/{product_id}?customer_id=N
 * Returns B2BKing pricing tiers, tax rules, and customer-specific prices.
 */
function amunet_get_b2bking_pricing(WP_REST_Request $request) {
    $product_id = intval($request['product_id']);
    $customer_id = intval($request->get_param('customer_id') ?: 0);

    $product = wc_get_product($product_id);
    if (!$product) return new WP_Error('not_found', 'Product not found', ['status' => 404]);

    $response = [
        'product_id'    => $product_id,
        'regular_price' => $product->get_regular_price(),
        'sale_price'    => $product->get_sale_price(),
        'price'         => $product->get_price(),
        'tax_status'    => $product->get_tax_status(),
        'tax_class'     => $product->get_tax_class(),
        'tiered_pricing' => [],
        'customer_group_pricing' => null,
        'tax_exempt' => false,
    ];

    // B2BKing tiered pricing rules
    $rules = get_posts([
        'post_type'   => 'b2bking_rule',
        'numberposts' => -1,
        'post_status' => 'publish',
    ]);

    foreach ($rules as $rule) {
        $rule_type = get_post_meta($rule->ID, 'b2bking_rule_what', true);
        $applies_to = get_post_meta($rule->ID, 'b2bking_rule_applies', true);
        $discount_type = get_post_meta($rule->ID, 'b2bking_rule_discount', true);
        $discount_value = get_post_meta($rule->ID, 'b2bking_rule_discount_value', true);

        // Check if rule applies to this product
        $rule_products = get_post_meta($rule->ID, 'b2bking_rule_applies_multiple_options', true);
        $applies = false;
        if ($applies_to === 'all_products') {
            $applies = true;
        } elseif ($rule_products) {
            $product_ids = array_map('intval', explode(',', $rule_products));
            $applies = in_array($product_id, $product_ids);
        }

        if ($applies && $rule_type === 'discount_quantity') {
            $min_qty = intval(get_post_meta($rule->ID, 'b2bking_rule_quantity', true) ?: 1);
            $response['tiered_pricing'][] = [
                'rule_id'        => $rule->ID,
                'min_quantity'   => $min_qty,
                'discount_type'  => $discount_type,
                'discount_value' => floatval($discount_value),
                'title'          => $rule->post_title,
            ];
        }
    }

    // Customer-specific B2BKing group pricing
    if ($customer_id) {
        $customer_group = get_user_meta($customer_id, 'b2bking_customergroup', true);
        if ($customer_group) {
            $group_post = get_post(intval($customer_group));
            $group_price = get_post_meta($product_id, 'b2bking_regular_product_price_group_' . $customer_group, true);
            $group_sale = get_post_meta($product_id, 'b2bking_sale_product_price_group_' . $customer_group, true);
            $tax_exempt = get_post_meta(intval($customer_group), 'b2bking_group_tax_exempt', true);

            $response['customer_group_pricing'] = [
                'group_id'      => intval($customer_group),
                'group_name'    => $group_post ? $group_post->post_title : '',
                'regular_price' => $group_price ?: null,
                'sale_price'    => $group_sale ?: null,
            ];
            $response['tax_exempt'] = ($tax_exempt === 'yes');
        }
    }

    // Sort tiers by min_quantity
    usort($response['tiered_pricing'], function ($a, $b) {
        return $a['min_quantity'] - $b['min_quantity'];
    });

    return rest_ensure_response($response);
}

/**
 * GET /b2bking-customer/{customer_id}
 * Returns B2BKing group, tax status, and pricing rules for a customer.
 */
function amunet_get_b2bking_customer(WP_REST_Request $request) {
    $customer_id = intval($request['customer_id']);
    $user = get_user_by('ID', $customer_id);
    if (!$user) return new WP_Error('not_found', 'Customer not found', ['status' => 404]);

    $group_id = get_user_meta($customer_id, 'b2bking_customergroup', true);
    $group_name = '';
    $tax_exempt = false;
    $group_discount = 0;

    if ($group_id) {
        $group_post = get_post(intval($group_id));
        $group_name = $group_post ? $group_post->post_title : '';
        $tax_exempt = get_post_meta(intval($group_id), 'b2bking_group_tax_exempt', true) === 'yes';
        $group_discount = floatval(get_post_meta(intval($group_id), 'b2bking_group_discount', true) ?: 0);
    }

    return rest_ensure_response([
        'customer_id' => $customer_id,
        'display_name' => $user->display_name,
        'email' => $user->user_email,
        'b2bking_group' => [
            'id' => $group_id ? intval($group_id) : null,
            'name' => $group_name,
            'tax_exempt' => $tax_exempt,
            'discount' => $group_discount,
        ],
        'is_b2b' => !empty($group_id),
    ]);
}

/**
 * GET /b2bking-groups
 * Returns all B2BKing customer groups.
 */
function amunet_get_b2bking_groups(WP_REST_Request $request) {
    $groups = get_posts(['post_type' => 'b2bking_group', 'numberposts' => -1, 'post_status' => 'publish']);
    $result = [];
    foreach ($groups as $group) {
        $tax_exempt = get_post_meta($group->ID, 'b2bking_group_tax_exempt', true);
        $discount = get_post_meta($group->ID, 'b2bking_group_discount', true);
        $members = get_users(['meta_key' => 'b2bking_customergroup', 'meta_value' => $group->ID, 'fields' => 'ID', 'number' => 0]);
        $result[] = [
            'id' => $group->ID,
            'name' => $group->post_title,
            'tax_exempt' => ($tax_exempt === 'yes'),
            'discount' => floatval($discount ?: 0),
            'member_count' => count($members),
        ];
    }
    return rest_ensure_response(['groups' => $result]);
}

// ═══════════════════════════════════════════════════════════════════════════
// ORDER TRACKING ENDPOINT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /order-tracking/{order_id}
 * Returns tracking info from the WooCommerce Orders Tracking plugin.
 */
function amunet_get_order_tracking(WP_REST_Request $request) {
    $order_id = intval($request['order_id']);
    $order = wc_get_order($order_id);
    if (!$order) return new WP_Error('not_found', 'Order not found', ['status' => 404]);

    // WooCommerce Orders Tracking plugin stores data in order meta
    $tracking_data = $order->get_meta('_wot_tracking_data');
    $tracking_number = $order->get_meta('_tracking_number') ?: $order->get_meta('_wot_tracking_number');
    $tracking_provider = $order->get_meta('_tracking_provider') ?: $order->get_meta('_wot_tracking_provider');
    $tracking_url = $order->get_meta('_tracking_url') ?: $order->get_meta('_wot_tracking_url');

    // Also check for the common AST (Advanced Shipment Tracking) format
    $ast_tracking = $order->get_meta('_wc_shipment_tracking_items');

    $tracking_items = [];
    if (!empty($ast_tracking) && is_array($ast_tracking)) {
        foreach ($ast_tracking as $item) {
            $tracking_items[] = [
                'provider'        => $item['tracking_provider'] ?? '',
                'tracking_number' => $item['tracking_number'] ?? '',
                'tracking_url'    => $item['custom_tracking_url'] ?? '',
                'date_shipped'    => $item['date_shipped'] ?? '',
            ];
        }
    }

    // Fallback to single tracking meta
    if (empty($tracking_items) && $tracking_number) {
        $tracking_items[] = [
            'provider'        => $tracking_provider ?: 'unknown',
            'tracking_number' => $tracking_number,
            'tracking_url'    => $tracking_url ?: '',
            'date_shipped'    => '',
        ];
    }

    // Also check vi_wot format
    if (empty($tracking_items) && !empty($tracking_data)) {
        $decoded = is_string($tracking_data) ? json_decode($tracking_data, true) : $tracking_data;
        if (is_array($decoded)) {
            foreach ($decoded as $td) {
                $tracking_items[] = [
                    'provider'        => $td['carrier_name'] ?? $td['provider'] ?? '',
                    'tracking_number' => $td['tracking_code'] ?? $td['tracking_number'] ?? '',
                    'tracking_url'    => $td['tracking_url'] ?? '',
                    'date_shipped'    => $td['date'] ?? '',
                ];
            }
        }
    }

    return rest_ensure_response([
        'order_id'       => $order_id,
        'order_status'   => $order->get_status(),
        'order_total'    => $order->get_total(),
        'currency'       => $order->get_currency(),
        'date_created'   => $order->get_date_created() ? $order->get_date_created()->format('Y-m-d H:i:s') : null,
        'date_paid'      => $order->get_date_paid() ? $order->get_date_paid()->format('Y-m-d H:i:s') : null,
        'payment_method' => $order->get_payment_method_title(),
        'has_tracking'   => !empty($tracking_items),
        'tracking'       => $tracking_items,
        'billing_name'   => $order->get_billing_first_name() . ' ' . $order->get_billing_last_name(),
        'billing_phone'  => $order->get_billing_phone(),
        'shipping_name'  => $order->get_shipping_first_name() . ' ' . $order->get_shipping_last_name(),
    ]);
}

// ═══════════════════════════════════════════════════════════════════════════
// PAYMENT & SHIPPING ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /payment-methods
 * Returns active WooCommerce payment gateways.
 */
function amunet_get_payment_methods(WP_REST_Request $request) {
    $gateways = WC()->payment_gateways()->get_available_payment_gateways();
    $result = [];
    foreach ($gateways as $id => $gw) {
        $result[] = [
            'id'          => $id,
            'title'       => $gw->get_title(),
            'description' => $gw->get_description(),
            'enabled'     => $gw->is_available(),
        ];
    }
    return rest_ensure_response(['methods' => $result]);
}

/**
 * GET /shipping-zones
 * Returns WooCommerce shipping zones with methods and rates.
 */
function amunet_get_shipping_zones(WP_REST_Request $request) {
    $zones_raw = WC_Shipping_Zones::get_zones();
    $result = [];

    // Add zone 0 (rest of the world)
    $zone0 = new WC_Shipping_Zone(0);
    $zones_raw[0] = [
        'zone_id'   => 0,
        'zone_name' => $zone0->get_zone_name(),
        'shipping_methods' => $zone0->get_shipping_methods(),
    ];

    foreach ($zones_raw as $zone_data) {
        $zone_id = $zone_data['zone_id'];
        $zone = new WC_Shipping_Zone($zone_id);
        $methods = $zone->get_shipping_methods();
        $methods_arr = [];
        foreach ($methods as $method) {
            $methods_arr[] = [
                'id'      => $method->id,
                'title'   => $method->get_title(),
                'enabled' => $method->is_enabled(),
                'cost'    => method_exists($method, 'get_option') ? $method->get_option('cost', '') : '',
            ];
        }
        $result[] = [
            'zone_id'   => $zone_id,
            'zone_name' => $zone->get_zone_name(),
            'methods'   => $methods_arr,
        ];
    }
    return rest_ensure_response(['zones' => $result]);
}

// ═══════════════════════════════════════════════════════════════════════════
// VISITOR TRACKER ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

function amunet_tracker_save($request) {
    global $wpdb;
    $table = $wpdb->prefix . 'amunet_visitors';
    $data = $request->get_json_params();
    $cookie_id = sanitize_text_field($data['cookie_id'] ?? '');
    if (!$cookie_id) return new WP_Error('missing_cookie', 'cookie_id required', ['status' => 400]);

    $products = is_array($data['products_visited'] ?? null) ? implode(', ', array_map('sanitize_text_field', $data['products_visited'])) : '';
    $pages = wp_json_encode($data['pages'] ?? []);

    $wpdb->query($wpdb->prepare(
        "INSERT INTO $table (cookie_id, utm_source, utm_medium, utm_campaign, utm_content, utm_term, products_visited, pages, referrer, landing_page)
         VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
         ON DUPLICATE KEY UPDATE
         utm_source=IF(VALUES(utm_source)!='', VALUES(utm_source), utm_source),
         utm_medium=IF(VALUES(utm_medium)!='', VALUES(utm_medium), utm_medium),
         utm_campaign=IF(VALUES(utm_campaign)!='', VALUES(utm_campaign), utm_campaign),
         utm_content=IF(VALUES(utm_content)!='', VALUES(utm_content), utm_content),
         utm_term=IF(VALUES(utm_term)!='', VALUES(utm_term), utm_term),
         products_visited=VALUES(products_visited),
         pages=VALUES(pages)",
        $cookie_id,
        sanitize_text_field($data['utm_source'] ?? ''),
        sanitize_text_field($data['utm_medium'] ?? ''),
        sanitize_text_field($data['utm_campaign'] ?? ''),
        sanitize_text_field($data['utm_content'] ?? ''),
        sanitize_text_field($data['utm_term'] ?? ''),
        $products,
        $pages,
        sanitize_text_field($data['referrer'] ?? ''),
        sanitize_text_field($data['landing_page'] ?? '')
    ));

    return ['ok' => true];
}

function amunet_tracker_get_by_phone($request) {
    global $wpdb;
    $table = $wpdb->prefix . 'amunet_visitors';
    $phone = sanitize_text_field($request['phone']);
    $row = $wpdb->get_row($wpdb->prepare(
        "SELECT * FROM $table WHERE phone = %s OR phone = %s OR phone = %s ORDER BY updated_at DESC LIMIT 1",
        $phone,
        preg_replace('/^52/', '', $phone),
        '52' . preg_replace('/^52/', '', $phone)
    ));
    if (!$row) return ['found' => false];
    return [
        'found'            => true,
        'cookie_id'        => $row->cookie_id,
        'utm_source'       => $row->utm_source,
        'utm_medium'       => $row->utm_medium,
        'utm_campaign'     => $row->utm_campaign,
        'products_visited' => $row->products_visited,
        'pages'            => json_decode($row->pages, true),
        'referrer'         => $row->referrer ?? '',
        'landing_page'     => $row->landing_page ?? '',
        'created_at'       => $row->created_at,
        'updated_at'       => $row->updated_at,
    ];
}

function amunet_tracker_get_by_cookie($request) {
    global $wpdb;
    $table = $wpdb->prefix . 'amunet_visitors';
    $cookie_id = sanitize_text_field($request['cookie_id']);
    $row = $wpdb->get_row($wpdb->prepare("SELECT * FROM $table WHERE cookie_id = %s", $cookie_id));
    if (!$row) return ['found' => false];
    return [
        'found'            => true,
        'phone'            => $row->phone,
        'utm_source'       => $row->utm_source,
        'utm_medium'       => $row->utm_medium,
        'utm_campaign'     => $row->utm_campaign,
        'products_visited' => $row->products_visited,
        'pages'            => json_decode($row->pages, true),
    ];
}

function amunet_tracker_link_phone($request) {
    global $wpdb;
    $table = $wpdb->prefix . 'amunet_visitors';
    $data = $request->get_json_params();
    $cookie_id = sanitize_text_field($data['cookie_id'] ?? '');
    $phone = sanitize_text_field($data['phone'] ?? '');
    if (!$cookie_id || !$phone) return new WP_Error('missing', 'cookie_id and phone required', ['status' => 400]);
    $wpdb->update($table, ['phone' => $phone], ['cookie_id' => $cookie_id]);
    return ['ok' => true];
}
