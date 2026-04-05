<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
if ( ! class_exists( 'VI_WOOCOMMERCE_ORDERS_TRACKING_NEXMO' ) ) {
	class VI_WOOCOMMERCE_ORDERS_TRACKING_NEXMO {
		protected $settings;
		protected $app_id;
		protected $app_token;

		public function __construct( $app_id, $app_token ) {
			$this->settings  = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_instance();
			$this->app_id    = $app_id;
			$this->app_token = $app_token;
		}

		public function send( $from, $to, $text, $country_code = '' ) {
			$return = array(
				'status' => 'error',
				'code'   => '',
				'data'   => esc_html__( 'Auth ID and Auth Token are required', 'woocommerce-orders-tracking' ),
			);
//			$text   = esc_html( $text );
			$to     = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::format_phone_number( $to, $country_code );
			if ( $this->app_id && $this->app_token ) {
				$url  = "https://rest.nexmo.com/sms/json";
				$body = array(
					'api_key'    => $this->app_id,
					'api_secret' => $this->app_token,
					'to'         => $to,
					'from'       => $from,
					'text'       => $text,
				);
				if ( $this->settings->get_params( 'sms_nexmo_unicode' ) ) {
					$body['type'] = 'unicode';
				}
				$response = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::wp_remote_post( $url, array( 'body' => $body ) );
				if ( $response['status'] === 'success' ) {
					$data     = vi_wot_json_decode( $response['data'] );
					$messages = $data['messages'][0];
					if ( intval( $messages['status'] ) > 0 ) {
						$return['data'] = $messages['error-text'];
						$return['code'] = $messages['status'];
					} else {
						$return['status'] = 'success';
						$return['data']   = $data;
					}
				} else {
					$return['data'] = $response['data'];
				}
			}

			return $return;
		}

		public function check_balance() {
			$return = array(
				'status' => 'error',
				'code'   => '',
				'data'   => esc_html__( 'Auth ID and Auth Token are required', 'woocommerce-orders-tracking' ),
			);
			if ( $this->app_id && $this->app_token ) {
				$url      = "https://rest.nexmo.com/account/get-balance";
				$body     = array(
					'api_key'    => $this->app_id,
					'api_secret' => $this->app_token
				);
				$response = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::wp_remote_get( $url, array( 'body' => $body ) );
				if ( $response['status'] === 'success' ) {
					$data = vi_wot_json_decode( $response['data'] );
					if ( empty( $data['error-code'] ) ) {
						$return['status'] = 'success';
						$return['data']   = $data['value'];
					} else {
						$return['data'] = $data['error-code'];
						$return['data'] = $data['error-code-label'];
					}
				} else {
					$return['data'] = $response['data'];
				}
			}

			return $return;
		}
	}
}
