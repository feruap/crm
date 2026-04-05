<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_SMS {
	protected static $settings;

	public function __construct() {
		self::$settings = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_instance();
	}

	/**
	 * Send SMS when tracking changes
	 *
	 * @param      $tracking_number
	 * @param      $carrier_name
	 * @param      $carrier_url
	 * @param      $tracking_url_import
	 * @param      $order WC_Order
	 * @param      $response
	 * @param bool $add_new_tracking
	 */
	public static function send_sms( $tracking_number, $carrier_name, $carrier_url, $tracking_url_import, $order, &$response, $add_new_tracking = false ) {
		$billing_phone = $order->get_billing_phone();
		if ( $billing_phone ) {
			$order_id           = $order->get_id();
			$order_number       = $order->get_order_number();
			$billing_country    = $order->get_billing_country();
			$billing_first_name = $order->get_billing_first_name();
			$billing_last_name  = $order->get_billing_last_name();

			$sms_provider = self::$settings->get_params( 'sms_provider' );
			$language     = '';
			if ( is_plugin_active( 'sitepress-multilingual-cms/sitepress.php' ) ) {
				$language = $order->get_meta( 'wpml_language', true );
			}
			if ( ! $language && function_exists( 'pll_get_post_language' ) ) {
				$language = pll_get_post_language( $order_id );
			}
			if ( $add_new_tracking ) {
				$text = self::$settings->get_params( 'sms_text_new', '', $language );
			} else {
				$text = self::$settings->get_params( 'sms_text', '', $language );
			}
			$shortlink = $tracking_url_import;
			if ( $bitly_access_token = self::$settings->get_params( 'bitly_access_token' ) ) {
				$bitly             = new VI_WOOCOMMERCE_ORDERS_TRACKING_BITLY( $bitly_access_token );
				$shortlink_request = $bitly->get_link( $shortlink );
				if ( $shortlink_request['status'] === 'success' ) {
					$shortlink = $shortlink_request['data']['link'];
				}
			}
			$text = str_replace( array(
				'{tracking_number}',
				'{tracking_url}',
				'{carrier_name}',
				'{carrier_url}',
				'{order_id}',
				'{order_number}',
				'{billing_first_name}',
				'{billing_last_name}'
			), array(
				$tracking_number,
				remove_query_arg( array( 'woo_orders_tracking_nonce', 'order_id', 'order_email' ), $shortlink ),
				$carrier_name,
				str_replace( array(
					'{tracking_number}',
					'{postal_code}'
				), '', esc_url( $carrier_url ) ),
				$order_id,
				$order_number,
				$billing_first_name,
				$billing_last_name
			), $text );

			$app_id    = self::$settings->get_params( "sms_{$sms_provider}_app_id" );
			$app_token = self::$settings->get_params( "sms_{$sms_provider}_app_token" );
			switch ( $sms_provider ) {
				case 'twilio':
					$sms_object             = new VI_WOOCOMMERCE_ORDERS_TRACKING_TWILIO( $app_id, $app_token );
					$from_number            = self::$settings->get_params( 'sms_from_number', '', $language );
					$sms_response           = $sms_object->send( $from_number, $billing_phone, $text, $billing_country );
					$response['sms_status'] = $sms_response['status'];
					if ( $sms_response['status'] === 'error' ) {
						$response['sms_message']       = $sms_response['data'];
						$response['sms_message_title'] = esc_html__( 'Failed sending SMS message', 'woocommerce-orders-tracking' );
					} elseif ( in_array( $sms_response['data']['status'], array( 'failed', 'undelivered' ) ) ) {
						$response['sms_status']        = 'error';
						$response['sms_message']       = isset( $sms_response['data']['error_message'] ) ? $sms_response['data']['error_message'] : '';
						$response['sms_message_title'] = esc_html__( 'Failed sending SMS message', 'woocommerce-orders-tracking' );
					} else {
						$response['sms_message_title'] = esc_html__( 'Send SMS message successfully', 'woocommerce-orders-tracking' );
						$response['sms_message']       = empty( $sms_response['body'] ) ? $text : $sms_response['body'];
					}
					break;
				case 'nexmo':
					$sms_object             = new VI_WOOCOMMERCE_ORDERS_TRACKING_NEXMO( $app_id, $app_token );
					$from_number            = self::$settings->get_params( 'sms_from_number', '', $language );
					$sms_response           = $sms_object->send( $from_number, $billing_phone, $text, $billing_country );
					$response['sms_status'] = $sms_response['status'];
					if ( $sms_response['status'] === 'error' ) {
						$response['sms_message_title'] = esc_html__( 'Failed sending SMS message', 'woocommerce-orders-tracking' );
						$response['sms_message']       = $sms_response['data'];
					} else {
						$response['sms_message_title'] = esc_html__( 'Send SMS message successfully', 'woocommerce-orders-tracking' );
						$response['sms_message']       = $text;
					}
					break;
				case 'plivo':
					$powerpack_uuid         = self::$settings->get_params( 'sms_plivo_powerpack_uuid' );
					$sms_object             = new VI_WOOCOMMERCE_ORDERS_TRACKING_PLIVO( $app_id, $app_token );
					$sms_response           = $sms_object->send( $powerpack_uuid, $billing_phone, $text, $billing_country );
					$response['sms_status'] = $sms_response['status'];
					if ( $sms_response['status'] === 'error' ) {
						$response['sms_message_title'] = esc_html__( 'Failed sending SMS message', 'woocommerce-orders-tracking' );
						$response['sms_message']       = $sms_response['data'];
					} else {
						$response['sms_message_title'] = esc_html__( 'Send SMS message successfully', 'woocommerce-orders-tracking' );
						$response['sms_message']       = $text;
					}
					break;
				default:
			}
		}
	}
}