<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
/**
 * Hooks for integrating with other plugins
 */
if ( ! class_exists( 'VI_WOOCOMMERCE_ORDERS_TRACKING_PLUGINS_Integration' ) ) {
	class VI_WOOCOMMERCE_ORDERS_TRACKING_PLUGINS_Integration {
		protected static $settings;

		/**
		 * VI_WOOCOMMERCE_ORDERS_TRACKING_PLUGINS_Integration constructor.
		 */
		public function __construct() {
			self::$settings = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_instance();
			add_action( 'woo_orders_tracking_updated_order_tracking_data', array(
				$this,
				'woo_orders_tracking_updated_order_tracking_data'
			), 10, 3 );
		}

		/**
		 * Save carrier name to use with other plugins
		 *
		 * @param $order_id
		 * @param $tracking_number
		 * @param $carrier
		 */
		public function woo_orders_tracking_updated_order_tracking_data( $order_id, $tracking_number, $carrier ) {
			if ( self::$settings->get_params( 'save_carrier_name_in_post_meta' ) ) {
				$display_name = empty( $carrier['display_name'] ) ? $carrier['name'] : $carrier['display_name'];
				if ( $display_name ) {
					$order = wc_get_order( $order_id );
					$order->update_meta_data( '_wot_tracking_carrier_name', $display_name );
					$order->save_meta_data();
				}
			}
		}
	}
}
