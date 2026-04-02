<?php
/**
 * Plugin Name: Amunet Visitor Tracker
 * Description: Tracks visitor navigation, UTMs, and product views. Integrates with Amunet CRM for personalized bot responses.
 * Version: 1.0.0
 * Author: Amunet CRM
 * Text Domain: amunet-visitor-tracker
 */

if (!defined('ABSPATH')) exit;

// Create table on activation
register_activation_hook(__FILE__, function() {
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
        products_visited TEXT DEFAULT NULL,
        pages TEXT DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY cookie_id (cookie_id),
        KEY phone (phone)
    ) $charset;";
    require_once ABSPATH . 'wp-admin/includes/upgrade.php';
    dbDelta($sql);
});

// Enqueue tracker script
add_action('wp_enqueue_scripts', function() {
    wp_enqueue_script('amunet-tracker', plugin_dir_url(__FILE__) . 'js/tracker.js', [], '1.0.0', true);
    wp_localize_script('amunet-tracker', 'amunetTrackerApi', rest_url('amunet-tracker/v1'));
});

// REST API: POST /track (save visitor data)
add_action('rest_api_init', function() {
    register_rest_route('amunet-tracker/v1', '/track', [
        'methods' => 'POST',
        'callback' => 'amunet_tracker_save',
        'permission_callback' => '__return_true',
    ]);
    register_rest_route('amunet-tracker/v1', '/visitor/(?P<phone>[0-9]+)', [
        'methods' => 'GET',
        'callback' => 'amunet_tracker_get_by_phone',
        'permission_callback' => '__return_true',
    ]);
    register_rest_route('amunet-tracker/v1', '/visitor-by-cookie/(?P<cookie_id>[a-zA-Z0-9_]+)', [
        'methods' => 'GET',
        'callback' => 'amunet_tracker_get_by_cookie',
        'permission_callback' => '__return_true',
    ]);
    register_rest_route('amunet-tracker/v1', '/link-phone', [
        'methods' => 'POST',
        'callback' => 'amunet_tracker_link_phone',
        'permission_callback' => '__return_true',
    ]);
});

function amunet_tracker_save($request) {
    global $wpdb;
    $table = $wpdb->prefix . 'amunet_visitors';
    $data = $request->get_json_params();
    $cookie_id = sanitize_text_field($data['cookie_id'] ?? '');
    if (!$cookie_id) return new WP_Error('missing_cookie', 'cookie_id required', ['status' => 400]);

    $products = is_array($data['products_visited'] ?? null) ? implode(', ', $data['products_visited']) : '';
    $pages = json_encode($data['pages'] ?? []);

    $wpdb->query($wpdb->prepare(
        "INSERT INTO $table (cookie_id, utm_source, utm_medium, utm_campaign, products_visited, pages)
         VALUES (%s, %s, %s, %s, %s, %s)
         ON DUPLICATE KEY UPDATE utm_source=VALUES(utm_source), utm_medium=VALUES(utm_medium),
         utm_campaign=VALUES(utm_campaign), products_visited=VALUES(products_visited), pages=VALUES(pages)",
        $cookie_id,
        sanitize_text_field($data['utm_source'] ?? ''),
        sanitize_text_field($data['utm_medium'] ?? ''),
        sanitize_text_field($data['utm_campaign'] ?? ''),
        $products,
        $pages
    ));

    return ['ok' => true];
}

function amunet_tracker_get_by_phone($request) {
    global $wpdb;
    $table = $wpdb->prefix . 'amunet_visitors';
    $phone = sanitize_text_field($request['phone']);
    // Try with and without country code
    $row = $wpdb->get_row($wpdb->prepare(
        "SELECT * FROM $table WHERE phone = %s OR phone = %s ORDER BY updated_at DESC LIMIT 1",
        $phone, preg_replace('/^52/', '', $phone)
    ));
    if (!$row) return ['found' => false];
    return [
        'found' => true,
        'utm_source' => $row->utm_source,
        'utm_medium' => $row->utm_medium,
        'utm_campaign' => $row->utm_campaign,
        'products_visited' => $row->products_visited,
        'pages' => json_decode($row->pages, true),
    ];
}

function amunet_tracker_get_by_cookie($request) {
    global $wpdb;
    $table = $wpdb->prefix . 'amunet_visitors';
    $cookie_id = sanitize_text_field($request['cookie_id']);
    $row = $wpdb->get_row($wpdb->prepare("SELECT * FROM $table WHERE cookie_id = %s", $cookie_id));
    if (!$row) return ['found' => false];
    return [
        'found' => true,
        'utm_source' => $row->utm_source,
        'products_visited' => $row->products_visited,
        'pages' => json_decode($row->pages, true),
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
