<?php
/**
 * Plugin Name: WooCommerce Orders Tracking Premium
 * Plugin URI: https://villatheme.com/extensions/woocommerce-orders-tracking
 * Description: Easily import/manage your tracking numbers, add tracking numbers to PayPal, send email/sms notifications to customers. Support AfterShip, EasyPost, TrackingMore and 17Track API.
 * Version: 1.1.16
 * Author: VillaTheme
 * Author URI: https://villatheme.com
 * Text Domain: woocommerce-orders-tracking
 * Domain Path: /languages
 * Copyright 2019-2025 VillaTheme.com. All rights reserved.
 * Requires Plugins: woocommerce
 * Tested up to: 6.7
 * WC tested up to: 9.7
 * Requires PHP: 7.0
 **/
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
include_once( ABSPATH . 'wp-admin/includes/plugin.php' );
define( 'VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION', '1.1.16' );
define( 'VI_WOOCOMMERCE_ORDERS_TRACKING_PATH_FILE', __FILE__ );
define( 'VI_WOOCOMMERCE_ORDERS_TRACKING_DIR', WP_PLUGIN_DIR . DIRECTORY_SEPARATOR . 'woocommerce-orders-tracking' . DIRECTORY_SEPARATOR );
define( 'VI_WOOCOMMERCE_ORDERS_TRACKING_INCLUDES', VI_WOOCOMMERCE_ORDERS_TRACKING_DIR . 'includes' . DIRECTORY_SEPARATOR );
/*Required for register_activation_hook*/
if ( is_file( VI_WOOCOMMERCE_ORDERS_TRACKING_INCLUDES . 'functions.php' ) ) {
	require_once VI_WOOCOMMERCE_ORDERS_TRACKING_INCLUDES . 'functions.php';
}
if ( is_file( VI_WOOCOMMERCE_ORDERS_TRACKING_INCLUDES . 'data.php' ) ) {
	require_once VI_WOOCOMMERCE_ORDERS_TRACKING_INCLUDES . 'data.php';
}
if ( is_file( VI_WOOCOMMERCE_ORDERS_TRACKING_INCLUDES . 'class-vi-woo-orders-tracking-track-info-table.php' ) ) {
	require_once VI_WOOCOMMERCE_ORDERS_TRACKING_INCLUDES . 'class-vi-woo-orders-tracking-track-info-table.php';
}
if ( is_file( VI_WOOCOMMERCE_ORDERS_TRACKING_INCLUDES . 'class-vi-woo-orders-tracking-trackingmore-table.php' ) ) {
	require_once VI_WOOCOMMERCE_ORDERS_TRACKING_INCLUDES . 'class-vi-woo-orders-tracking-trackingmore-table.php';
}

if ( ! class_exists( 'VIWOT_WOOCOMMERCE_ORDERS_TRACKING' ) ) {
	class VIWOT_WOOCOMMERCE_ORDERS_TRACKING {
		protected $settings;

		public function __construct() {
			add_action( 'plugins_loaded', array( $this, 'check_environment' ) );
			//compatible with 'High-Performance order storage (COT)'
			add_action( 'before_woocommerce_init', array( $this, 'before_woocommerce_init' ) );
			add_action( 'activated_plugin', array( $this, 'install' ), 10, 2 );
		}
		public function check_environment() {
			if ( ! class_exists( 'VillaTheme_Require_Environment' ) ) {
				include_once VI_WOOCOMMERCE_ORDERS_TRACKING_INCLUDES. 'support.php';
			}
			$environment = new VillaTheme_Require_Environment( [
					'plugin_name'     => 'WooCommerce Orders Tracking',
					'php_version'     => '7.0',
					'wp_version'      => '5.0',
					'require_plugins' => [
						[
							'slug' => 'woocommerce',
							'name' => 'WooCommerce',
							'required_version' => '7.0',
						],
					]
				]
			);
			if ( $environment->has_error() ) {
				return;
			}
			require_once VI_WOOCOMMERCE_ORDERS_TRACKING_INCLUDES . "define.php";
		}
		public function before_woocommerce_init() {
			if ( class_exists( '\Automattic\WooCommerce\Utilities\FeaturesUtil' ) ) {
				\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'custom_order_tables', __FILE__, true );
			}
		}

		public static function install($plugin, $network_wide) {
			if ( $plugin !== plugin_basename( __FILE__ ) ) {
				return;
			}
			wp_unschedule_hook( 'vi_wot_refresh_track_info' );
			global $wpdb;
			if ( function_exists( 'is_multisite' ) && is_multisite() && $network_wide ) {
				$current_blog = $wpdb->blogid;
				$blogs        = $wpdb->get_col( "SELECT blog_id FROM {$wpdb->blogs}" );// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

				//Multi site activate action
				foreach ( $blogs as $blog ) {
					switch_to_blog( $blog );
					/*Create custom table to store tracking data*/
					VI_WOOCOMMERCE_ORDERS_TRACKING_TRACKINGMORE_TABLE::create_table();
					VI_WOOCOMMERCE_ORDERS_TRACKING_TRACK_INFO_TABLE::create_table();
				}
				switch_to_blog( $current_blog );
			} else {
				//Single site activate action
				/*Create custom table to store tracking data*/
				VI_WOOCOMMERCE_ORDERS_TRACKING_TRACKINGMORE_TABLE::create_table();
				VI_WOOCOMMERCE_ORDERS_TRACKING_TRACK_INFO_TABLE::create_table();
			}
			/*create tracking page*/
			if ( ! get_option( 'woo_orders_tracking_settings' ) ) {
				$current_user = wp_get_current_user();
				// create post object
				$page = array(
					'post_title'  => esc_html__( 'Orders Tracking', 'woocommerce-orders-tracking' ),
					'post_status' => 'publish',
					'post_author' => $current_user->ID,
					'post_type'   => 'page',
					'post_name'   => 'orders-tracking',
				);
				// insert the post into the database
				$page_id = wp_insert_post( $page, true );
				if ( ! is_wp_error( $page_id ) ) {
					$settings                      = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_instance();
					$args                          = $settings->get_params();
					$args['service_tracking_page'] = $page_id;
					update_option( 'woo_orders_tracking_settings', $args );
				}
			}
		}
	}
}
new VIWOT_WOOCOMMERCE_ORDERS_TRACKING();