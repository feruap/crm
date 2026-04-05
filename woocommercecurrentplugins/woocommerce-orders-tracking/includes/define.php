<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
define( 'VI_WOOCOMMERCE_ORDERS_TRACKING_LANGUAGES', VI_WOOCOMMERCE_ORDERS_TRACKING_DIR . 'languages' . DIRECTORY_SEPARATOR );
define( 'VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN', VI_WOOCOMMERCE_ORDERS_TRACKING_INCLUDES . 'admin' . DIRECTORY_SEPARATOR );
define( 'VI_WOOCOMMERCE_ORDERS_TRACKING_FRONTEND', VI_WOOCOMMERCE_ORDERS_TRACKING_INCLUDES . 'frontend' . DIRECTORY_SEPARATOR );
define( 'VI_WOOCOMMERCE_ORDERS_TRACKING_TEMPLATES', VI_WOOCOMMERCE_ORDERS_TRACKING_INCLUDES . 'templates' . DIRECTORY_SEPARATOR );
define( 'VI_WOOCOMMERCE_ORDERS_TRACKING_PLUGINS', VI_WOOCOMMERCE_ORDERS_TRACKING_INCLUDES . 'plugins' . DIRECTORY_SEPARATOR );
/*Use the same cache folder as free version*/
define( 'VI_WOOCOMMERCE_ORDERS_TRACKING_CACHE', WP_CONTENT_DIR . '/cache/woo-orders-tracking/' );
$plugin_url = plugins_url( '', __FILE__ );
$plugin_url = str_replace( '/includes', '/assets', $plugin_url );
define( 'VI_WOOCOMMERCE_ORDERS_TRACKING_CSS', $plugin_url . '/css/' );
define( 'VI_WOOCOMMERCE_ORDERS_TRACKING_CSS_DIR', VI_WOOCOMMERCE_ORDERS_TRACKING_DIR . 'css' . DIRECTORY_SEPARATOR );
define( 'VI_WOOCOMMERCE_ORDERS_TRACKING_JS', $plugin_url . '/js/' );
define( 'VI_WOOCOMMERCE_ORDERS_TRACKING_JS_DIR', VI_WOOCOMMERCE_ORDERS_TRACKING_DIR . 'js' . DIRECTORY_SEPARATOR );
define( 'VI_WOOCOMMERCE_ORDERS_TRACKING_IMAGES', $plugin_url . '/images/' );
define( 'VI_WOOCOMMERCE_ORDERS_TRACKING_PACKAGES', VI_WOOCOMMERCE_ORDERS_TRACKING_DIR . 'assets/packages/' );
define( 'VI_WOOCOMMERCE_ORDERS_TRACKING_PAYPAL_IMAGE', VI_WOOCOMMERCE_ORDERS_TRACKING_IMAGES . 'paypal.png' );
define( 'VI_WOOCOMMERCE_ORDERS_TRACKING_LOADING_IMAGE', VI_WOOCOMMERCE_ORDERS_TRACKING_IMAGES . 'loading.gif' );

if ( is_file( VI_WOOCOMMERCE_ORDERS_TRACKING_INCLUDES . 'track-info-table.php' ) ) {
	require_once VI_WOOCOMMERCE_ORDERS_TRACKING_INCLUDES . 'track-info-table.php';
}
if ( is_file( VI_WOOCOMMERCE_ORDERS_TRACKING_INCLUDES . 'class-vi-woo-orders-tracking-tracktry.php' ) ) {
	require_once VI_WOOCOMMERCE_ORDERS_TRACKING_INCLUDES . 'class-vi-woo-orders-tracking-tracktry.php';
}
if ( is_file( VI_WOOCOMMERCE_ORDERS_TRACKING_INCLUDES . 'class-vi-woo-orders-tracking-vitracking.php' ) ) {
	require_once VI_WOOCOMMERCE_ORDERS_TRACKING_INCLUDES . 'class-vi-woo-orders-tracking-vitracking.php';
}
if ( is_file( VI_WOOCOMMERCE_ORDERS_TRACKING_INCLUDES . 'class-vi-woo-orders-tracking-17track.php' ) ) {
	require_once VI_WOOCOMMERCE_ORDERS_TRACKING_INCLUDES . 'class-vi-woo-orders-tracking-17track.php';
}
if ( is_file( VI_WOOCOMMERCE_ORDERS_TRACKING_INCLUDES . 'class-vi-woo-orders-tracking-easypost.php' ) ) {
	require_once VI_WOOCOMMERCE_ORDERS_TRACKING_INCLUDES . 'class-vi-woo-orders-tracking-easypost.php';
}
if ( is_file( VI_WOOCOMMERCE_ORDERS_TRACKING_INCLUDES . 'class-vi-woo-orders-tracking-trackingmore.php' ) ) {
	require_once VI_WOOCOMMERCE_ORDERS_TRACKING_INCLUDES . 'class-vi-woo-orders-tracking-trackingmore.php';
}
if ( is_file( VI_WOOCOMMERCE_ORDERS_TRACKING_INCLUDES . 'class-vi-woo-orders-tracking-aftership.php' ) ) {
	require_once VI_WOOCOMMERCE_ORDERS_TRACKING_INCLUDES . 'class-vi-woo-orders-tracking-aftership.php';
}
if ( is_file( VI_WOOCOMMERCE_ORDERS_TRACKING_INCLUDES . 'class-vi-woo-orders-tracking-twilio.php' ) ) {
	require_once VI_WOOCOMMERCE_ORDERS_TRACKING_INCLUDES . 'class-vi-woo-orders-tracking-twilio.php';
}
if ( is_file( VI_WOOCOMMERCE_ORDERS_TRACKING_INCLUDES . 'class-vi-woo-orders-tracking-nexmo.php' ) ) {
	require_once VI_WOOCOMMERCE_ORDERS_TRACKING_INCLUDES . 'class-vi-woo-orders-tracking-nexmo.php';
}
if ( is_file( VI_WOOCOMMERCE_ORDERS_TRACKING_INCLUDES . 'class-vi-woo-orders-tracking-plivo.php' ) ) {
	require_once VI_WOOCOMMERCE_ORDERS_TRACKING_INCLUDES . 'class-vi-woo-orders-tracking-plivo.php';
}
if ( is_file( VI_WOOCOMMERCE_ORDERS_TRACKING_INCLUDES . 'class-vi-woo-orders-tracking-bitly.php' ) ) {
	require_once VI_WOOCOMMERCE_ORDERS_TRACKING_INCLUDES . 'class-vi-woo-orders-tracking-bitly.php';
}
if ( is_file( VI_WOOCOMMERCE_ORDERS_TRACKING_INCLUDES . 'custom-controls.php' ) ) {
	require_once VI_WOOCOMMERCE_ORDERS_TRACKING_INCLUDES . 'custom-controls.php';
}
if ( is_file( VI_WOOCOMMERCE_ORDERS_TRACKING_INCLUDES . 'support.php' ) ) {
	require_once VI_WOOCOMMERCE_ORDERS_TRACKING_INCLUDES . 'support.php';
}
if ( is_file( VI_WOOCOMMERCE_ORDERS_TRACKING_INCLUDES . 'check_update.php' ) ) {
	require_once VI_WOOCOMMERCE_ORDERS_TRACKING_INCLUDES . 'check_update.php';
}
if ( is_file( VI_WOOCOMMERCE_ORDERS_TRACKING_INCLUDES . 'update.php' ) ) {
	require_once VI_WOOCOMMERCE_ORDERS_TRACKING_INCLUDES . 'update.php';
}
vi_include_folder( VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN, 'VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_' );
vi_include_folder( VI_WOOCOMMERCE_ORDERS_TRACKING_FRONTEND, 'VI_WOOCOMMERCE_ORDERS_TRACKING_FRONTEND_' );
vi_include_folder( VI_WOOCOMMERCE_ORDERS_TRACKING_PLUGINS, 'VI_WOOCOMMERCE_ORDERS_TRACKING_PLUGINS_' );