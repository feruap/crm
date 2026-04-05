<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
if ( ! class_exists( 'VI_WOOCOMMERCE_ORDERS_TRACKING_BITLY' ) ) {
	class VI_WOOCOMMERCE_ORDERS_TRACKING_BITLY {
		protected $app_token;

		public function __construct( $app_token ) {
			$this->app_token = $app_token;
		}

		public function get_link( $long_url ) {
			$return = array(
				'status' => 'error',
				'code'   => '',
				'data'   => esc_html__( 'Access Token is required', 'woocommerce-orders-tracking' ),
			);
			if ( $this->app_token ) {
				$url            = 'https://api-ssl.bitly.com/v4/shorten';
				$headers        = array(
					'Authorization' => "Bearer {$this->app_token}",
					'Content-Type'  => 'application/json',
				);
				$body           = array(
					'long_url' => $long_url,
				);
				$response       = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::wp_remote_post( $url, array(
					'headers' => $headers,
					'body'    => vi_wot_json_encode( $body )
				) );
				$return['code'] = $response['code'];
				if ( $response['status'] === 'success' ) {
					if ( $response['code'] == 200 || $response['code'] == 201 ) {
						$return['status'] = 'success';
						$return['data']   = vi_wot_json_decode( $response['data'] );
					} else {
						$response_body = vi_wot_json_decode( $response['data'] );
						if ( ! empty( $response_body['description'] ) ) {
							$return['data'] = $response_body['description'];
						} elseif ( ! empty( $response_body['message'] ) ) {
							$return['data'] = $response_body['message'];
						} else {
							$return['data'] = esc_html__( 'Unknown Error', 'woocommerce-orders-tracking' );
						}
					}
				} else {
					$return['data'] = $response['data'];
				}
			}

			return $return;
		}
	}
}
