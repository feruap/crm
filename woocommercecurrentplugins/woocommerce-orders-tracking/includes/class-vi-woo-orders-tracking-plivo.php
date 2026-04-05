<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
if ( ! class_exists( 'VI_WOOCOMMERCE_ORDERS_TRACKING_PLIVO' ) ) {
	class VI_WOOCOMMERCE_ORDERS_TRACKING_PLIVO {
		protected $settings;
		protected $app_id;
		protected $app_token;

		public function __construct( $app_id, $app_token ) {
			$this->app_id    = $app_id;
			$this->app_token = $app_token;
		}

		public function send( $powerpack_uuid, $to, $text, $country_code = '' ) {
			$return = array(
				'status' => 'error',
				'code'   => '',
				'data'   => esc_html__( 'Auth ID and Auth Token are required', 'woocommerce-orders-tracking' ),
			);
//			$text   = esc_html( $text );
			$to     = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::format_phone_number( $to, $country_code );
			if ( $this->app_id && $this->app_token ) {
				$url            = "https://api.plivo.com/v1/Account/{$this->app_id}/Message/";
				$headers        = array(
					'Authorization' => 'Basic ' . base64_encode( "{$this->app_id}:{$this->app_token}" )
				);
				$body           = array(
					'powerpack_uuid' => $powerpack_uuid,
					'dst'            => $to,
					'text'           => $text,
				);
				$response       = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::wp_remote_post( $url, array(
					'headers' => $headers,
					'body'    => $body
				) );
				$return['code'] = $response['code'];
				if ( $response['status'] === 'success' ) {
					$response_body = vi_wot_json_decode( $response['data']);
					if ( $response['code'] < 400 ) {
						$return['status'] = 'success';
						$return['data']   = $response_body;
					} else {
						$return['data'] = $response_body['error'];
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
				$url            = "https://api.plivo.com/v1/Account/{$this->app_id}/";
				$headers        = array(
					'Authorization' => 'Basic ' . base64_encode( "{$this->app_id}:{$this->app_token}" )
				);
				$response       = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::wp_remote_get( $url, array( 'headers' => $headers ) );
				$return['code'] = $response['code'];
				if ( $response['status'] === 'success' ) {
					if ( $response['code'] < 400 ) {
						$return['status'] = 'success';
						$return['data']   = vi_wot_json_decode( $response['data'])['cash_credits'];
					} else {
						$return['data'] = $response['data'];
					}
				} else {
					$return['data'] = $response['data'];
				}
			}

			return $return;
		}
	}
}
