<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
/**
 * Aliexpress Dropshipping and Fulfillment for WooCommerce
 */
if ( ! class_exists( 'VI_WOOCOMMERCE_ORDERS_TRACKING_PLUGINS_WooCommerce_Alidropship' ) ) {
	class VI_WOOCOMMERCE_ORDERS_TRACKING_PLUGINS_WooCommerce_Alidropship {
		protected static $settings;

		/**
		 * VI_WOOCOMMERCE_ORDERS_TRACKING_PLUGINS_WooCommerce_Alidropship constructor.
		 */
		public function __construct() {
			self::$settings = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_instance();
			add_action( 'vi_wad_sync_aliexpress_order_tracking_info', array(
				$this,
				'vi_wad_sync_aliexpress_order_tracking_info'
			), 10, 5 );
			add_filter( 'vi_woo_alidropship_order_item_tracking_data', array(
				$this,
				'vi_woo_alidropship_order_item_tracking_data'
			), 10, 3 );
		}

		public function vi_woo_alidropship_order_item_tracking_data( $current_tracking_data, $item_id, $order_id ) {
			if ( ! empty( $current_tracking_data['carrier_slug'] ) ) {
				$carrier = self::$settings->get_shipping_carrier_by_slug( $current_tracking_data['carrier_slug'] );
				if ( is_array( $carrier ) && count( $carrier ) ) {
					$current_tracking_data['carrier_name'] = $carrier['name'];
					$order                                 = wc_get_order( $order_id );
					$postal_code                           = '';
					if ( $order ) {
						$postal_code = $order->get_shipping_postcode();
					}
					$current_tracking_data['carrier_url'] = self::$settings->get_url_tracking( $carrier['url'], $current_tracking_data['tracking_number'],
						$current_tracking_data['carrier_slug'], $postal_code );
				}
			}

			return $current_tracking_data;
		}

		/**
		 * @param $current_tracking_data
		 * @param $old_tracking_data
		 * @param $status_switch_to_shipped
		 * @param $order_item_id
		 * @param $order_id
		 *
		 * @throws Exception
		 */
		public function vi_wad_sync_aliexpress_order_tracking_info( $current_tracking_data, $old_tracking_data, $status_switch_to_shipped, $order_item_id, $order_id ) {
			if ( $current_tracking_data['tracking_number'] ) {
				$tracking_number = $current_tracking_data['tracking_number'];
				$carrier_slug    = $current_tracking_data['carrier_slug'];
				$carrier_name    = $current_tracking_data['carrier_name'];
				$carrier_url     = $current_tracking_data['carrier_url'];
				$order           = wc_get_order( $order_id );
				if ( $order ) {
					$carrier      = self::$settings->get_shipping_carrier_by_slug( $carrier_slug );
					$display_name = $carrier_name;
					if ( is_array( $carrier ) && count( $carrier ) ) {
						if ( ! empty( $carrier['display_name'] ) ) {
							$display_name = $carrier['display_name'];
						} else {
							$display_name = $carrier['name'];
						}
					}
					if ( self::$settings->get_params( 'paypal_add_after_aliexpress_order_synced' ) ) {
						$transID                = $order->get_transaction_id();
						$paypal_method          = $order->get_payment_method();
						$paypal_added_trackings = $order->get_meta( 'vi_wot_paypal_added_tracking_numbers', true );
						if ( ! $paypal_added_trackings ) {
							$paypal_added_trackings = array();
						}
						if ( ! in_array( $tracking_number, $paypal_added_trackings ) && $transID && $paypal_method ) {
							$send_paypal = array(
								array(
									'trans_id'        => $transID,
									'carrier_name'    => $carrier_name,
//									'carrier_name'    => $display_name,
									'tracking_number' => $tracking_number,
								)
							);
							$credentials = VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_PAYPAL::get_api_credentials( $paypal_method );
							if ( $credentials['id'] && $credentials['secret'] ) {
								$result = VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_PAYPAL::add_tracking_number( $credentials['id'], $credentials['secret'], $send_paypal,
									$credentials['sandbox'] );
								if ( $result['status'] === 'success' ) {
									$paypal_added_trackings[] = $tracking_number;
									$order->update_meta_data( 'vi_wot_paypal_added_tracking_numbers', $paypal_added_trackings );
									$order->save_meta_data();
								}
							}
						}
					}
					if ( $tracking_number != $old_tracking_data['tracking_number'] || $status_switch_to_shipped ) {
						/*Send email if enabled*/
						if ( self::$settings->get_params( 'email_send_after_aliexpress_order_synced' ) ) {
							VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_EMAIL::send_email( $order_id );
						}
						/*Send SMS if enabled*/
						if ( self::$settings->get_params( 'sms_send_after_aliexpress_order_synced' ) ) {
							$add_new_tracking = false;
							if ( empty( $old_tracking_data['tracking_number'] ) ) {
								$add_new_tracking = true;
							}
							VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_SMS::send_sms( $tracking_number, $display_name, $carrier_url,
								self::$settings->get_url_tracking( $carrier_url, $tracking_number, $carrier_slug, $order->get_shipping_postcode(), false, false, $order_id ),
								$order, $response, $add_new_tracking );
						}
					}
					VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::add_tracking_to_service( $tracking_number, $carrier_slug, $carrier_name, $order_id, $api_error );
				}
			}
		}
	}
}
