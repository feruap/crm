<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
if ( ! class_exists( 'VI_WOOCOMMERCE_ORDERS_TRACKING_TWILIO' ) ) {
	class VI_WOOCOMMERCE_ORDERS_TRACKING_TWILIO {
		protected $settings;
		protected $app_id;
		protected $app_token;

		public function __construct( $app_id, $app_token ) {
			$this->app_id    = $app_id;
			$this->app_token = $app_token;
		}

		public function send( $from, $to, $text, $country_code = '' ) {
			$return = array(
				'status' => 'error',
				'code'   => '',
				'data'   => esc_html__( 'Auth ID and Auth Token are required', 'woocommerce-orders-tracking' ),
			);
			$to     = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::format_phone_number( $to, $country_code );
			if ( $this->app_id && $this->app_token ) {
				$url            = "https://api.twilio.com/2010-04-01/Accounts/" . $this->app_id . "/Messages.json";
				$headers        = array(
					'Authorization' => 'Basic ' . base64_encode( "{$this->app_id}:{$this->app_token}" )
				);
				$body           = array(
					'From' => $from,
					'To'   => $to,
					'Body' => $text
				);
				$response       = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::wp_remote_post( $url, array(
					'headers' => $headers,
					'body'    => $body
				) );
				$return['code'] = $response['code'];
				if ( $response['status'] === 'success' ) {
					$response_body = vi_wot_json_decode( $response['data'] );
					if ( empty( $response_body['code'] ) ) {
						$return['status'] = 'success';
						$return['data']   = $response_body;
					} else {
						$return['data'] = $response_body['message'];
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
				$url            = "https://api.twilio.com/2010-04-01/Accounts/" . $this->app_id . "/Balance.json";
				$headers        = array(
					'Authorization' => 'Basic ' . base64_encode( "{$this->app_id}:{$this->app_token}" )
				);
				$response       = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::wp_remote_get( $url, array( 'headers' => $headers ) );
				$return['code'] = $response['code'];
				if ( $response['status'] === 'success' ) {
					$response_body = vi_wot_json_decode( $response['data']);
					if ( empty( $response_body['code'] ) ) {
						$return['status'] = 'success';
						$return['data']   = $response_body['balance'];
					} else {
						$return['data'] = $response_body['message'];
					}
				} else {
					$return['data'] = $response['data'];
				}
			}

			return $return;
		}
	}
}
