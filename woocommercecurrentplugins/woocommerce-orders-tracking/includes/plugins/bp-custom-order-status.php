<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
/**
 * Custom Order Status Manager for WooCommerce plugin - Bright Plugins
 */
if ( ! class_exists( 'VI_WOOCOMMERCE_ORDERS_TRACKING_PLUGINS_Bp_Custom_Order_Status' ) ) {
	class VI_WOOCOMMERCE_ORDERS_TRACKING_PLUGINS_Bp_Custom_Order_Status {
		public function __construct() {
			if ( is_plugin_active( 'bp-custom-order-status-for-woocommerce/main.php' ) ) {
				add_filter( 'woocommerce_orders_tracking_email_woo_statuses', array( $this, 'orders_tracking_email_woo_statuses' ) );
			}
		}

		public function orders_tracking_email_woo_statuses( $email_woo_statuses ) {
			$arg = array(
				'numberposts' => -1,
				'post_type'   => 'order_status',
				'meta_query'  => [[// phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query
					'key'     => '_enable_email',
					'compare' => '=',
					'value'   => '1',
				]],
			);
			$postStatusList = get_posts( $arg );

			foreach ( $postStatusList as $post ) {
				$status_index = get_post_meta( $post->ID, 'status_slug', true );
				$status_id = 'bvos_custom_' . $status_index;
				if ( ! isset( $email_woo_statuses[ $status_id ] ) ) {
					$email_woo_statuses[ $status_id ] = $post->post_title;
				}

			}
			return $email_woo_statuses;
		}

	}
}
