<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
if ( ! class_exists( 'VI_WOOCOMMERCE_ORDERS_TRACKING_TRACKTRY' ) ) {
	class VI_WOOCOMMERCE_ORDERS_TRACKING_TRACKTRY {
		const END_POINT = 'https://api.tracktry.com/v1/';
		const AUTH_HEADER = 'Tracktry-Api-Key';
		protected $api_key;
		protected static $carriers;

		public function __construct( $api_key ) {
			$this->api_key = $api_key;
		}

		/**
		 * Register multiple tracking numbers, maximum 40 per request
		 *
		 * @param $trackings array
		 *
		 * @return array
		 */
		public function create( $trackings ) {
			$response = array(
				'status'            => 'error',
				'est_delivery_date' => '',
				'code'              => '',
				'data'              => '',
			);
			if ( ! is_array( $trackings ) || count( $trackings ) >= 40 ) {
				$response['data'] = esc_html__( 'Maximum 40 tracking numbers per request', 'woocommerce-orders-tracking' );

				return $response;
			}
			if ( $this->api_key ) {
				$trackings_      = array();
				$optional_params = array(
					'customer_name',
					'customer_email',
					'customer_phone',
					'order_id',
					'tracking_postal_code',
					'lang',
				);
				foreach ( $trackings as &$tracking ) {
					$tracking['status']           = 'success';
					$tracking['message']          = '';
					$tracking['tracktry_carrier'] = '';
					$tracking_                    = array(
						'tracking_number' => isset( $tracking['tracking_number'] ) ? $tracking['tracking_number'] : '',
						'carrier_code'    => '',
					);
					if ( ! empty( $tracking['carrier_name'] ) ) {
						$tracking_['carrier_code']    = self::get_carrier_slug_by_name( $tracking['carrier_name'] );
						$tracking['tracktry_carrier'] = $tracking_['carrier_code'];
					} else {
						$tracking['carrier_name'] = '';
					}
					foreach ( $optional_params as $optional_param ) {
						if ( ! empty( $tracking[ $optional_param ] ) ) {
							$tracking_[ $optional_param ] = $tracking[ $optional_param ];
						}
					}
					$trackings_[] = $tracking_;
				}
				$url          = self::END_POINT . 'trackings/batch';
				$args         = array(
					'headers' => array(
						self::AUTH_HEADER => $this->api_key,
						'Content-Type'    => 'application/json',
					),
					'body'    => vi_wot_json_encode( $trackings_ )
				);
				$request_data = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::wp_remote_post( $url, $args );
				if ( $request_data['status'] === 'success' ) {
					$body               = vi_wot_json_decode( $request_data['data'] );
					$response['status'] = 'success';
					$errors             = isset( $body['data']['errors'] ) ? $body['data']['errors'] : array();
					if ( count( $errors ) ) {
						foreach ( $errors as $error ) {
							if ( ! is_array( $error ) ) {
								$error = vi_wot_json_decode( $error );
								if ( isset( $error['meta'] ) ) {
									$error = $error['meta'];
								}
							}
							if ( ! empty( $error['tracking_number'] ) ) {
								foreach ( $trackings_ as $key_1 => $value_1 ) {
									if ( $error['tracking_number'] === $value_1['tracking_number'] ) {
										if ( 4016 == $error['code'] ) {
											$trackings[ $key_1 ]['status'] = 'exist';
										} else {
											$trackings[ $key_1 ]['status'] = 'error';
										}
										$trackings[ $key_1 ]['message'] = $error['message'];
										$trackings[ $key_1 ]['code']    = $error['code'];
										break;
									}
								}
							}
						}
					}
					$response['data'] = $trackings;
				} else {
					$response['data'] = $request_data['data'];
				}
			} else {
				$response['data'] = esc_html__( 'Empty API', 'woocommerce-orders-tracking' );
			}

			return $response;
		}

		public function get_multiple_trackings( $numbers = array(), $orders = array(), $created_at_min = '', $created_at_max = '', $status = '', $page = 1, $limit = 2000 ) {
			$response = array(
				'status'            => 'error',
				'est_delivery_date' => '',
				'code'              => '',
				'data'              => '',
			);
			if ( $this->api_key ) {
				$query_args = array(
					'numbers' => implode( ',', $numbers ),
					'orders'  => implode( ',', $orders ),
					'page'    => $page,
					'limit'   => $limit,
					'status'  => $status,
				);
				if ( $created_at_min ) {
					$query_args['created_at_min'] = strtotime( $created_at_min );
				}
				if ( $created_at_max ) {
					$query_args['created_at_max'] = strtotime( $created_at_max );
				}
				$url          = self::END_POINT . 'trackings/get';
				$url          = add_query_arg( $query_args, $url );
				$args         = array(
					'headers' => array(
						self::AUTH_HEADER => $this->api_key,
						'Content-Type'    => 'application/json',
					),
				);
				$request_data = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::wp_remote_get( $url, $args );
				if ( $request_data['status'] === 'success' ) {
					$data             = vi_wot_json_decode( $request_data['data'] );
					$response['code'] = $data['meta']['code'];
					if ( $data['meta']['code'] == 200 ) {
						$response['status'] = 'success';
						$response['data']   = $data['data'];
					} else {
						$response['data'] = $data['meta']['message'];
					}
				} else {
					$response['data'] = $request_data['data'];
				}
			} else {
				$response['data'] = esc_html__( 'Empty API', 'woocommerce-orders-tracking' );
			}

			return $response;
		}

		/**
		 * @param $tracking
		 *
		 * @return array
		 */
		public static function get_track_info( $tracking ) {
			$track_info = array();
			if ( isset( $tracking['origin_info']['trackinfo'] ) ) {
				if ( is_array( $tracking['origin_info']['trackinfo'] ) && count( $tracking['origin_info']['trackinfo'] ) ) {
					foreach ( $tracking['origin_info']['trackinfo'] as $event ) {
						$temp = array(
							'time'        => $event['Date'],
							'description' => $event['StatusDescription'],
							'location'    => $event['Details'],
							'status'      => $event['checkpoint_status'],
						);
						if (!empty($event['substatus'])){
							if (strpos($event['substatus'],'delivered') === 0){
								if ($temp['status'] !== 'delivered'){
									$temp['status'] ='delivered';
								}
							}elseif ($temp['status'] === 'delivered'){
								$temp['status'] ='transit';
							}
						}
						$track_info[] = $temp;
					}
				}
			}

			return array_values( $track_info );
		}
		public function get_tracking_response(&$response, $request_data,$carrier_code='', $tracking_number=''){
			if ( $request_data['status'] === 'success' ) {
				$body             = vi_wot_json_decode( $request_data['data'] );
				$response['code'] = $body['meta']['code'];
				if ( $body['meta']['code'] == 200 ) {
					$data = $body['data'][0] ?? $body['data']['items'][0] ?? array();
					if($carrier_code && $tracking_number &&
					   $this->api_key && empty($response['retrack']) &&
					   $data['status'] === 'pending' && ! isset( $tracking['origin_info']['trackinfo'] ) ){
						$response['retrack'] = true;
						$url          = self::END_POINT . "trackings/realtime";
						$args         = array(
							'headers' => array(
								self::AUTH_HEADER => $this->api_key,
								'Content-Type'    => 'application/json',
							),
							'body'    => vi_wot_json_encode( array(
								'tracking_number'=> $tracking_number,
								'carrier_code'=> $carrier_code
							) )
						);
						$request_data = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::wp_remote_post( $url, $args );
						$this->get_tracking_response($response, $request_data);
					}else {
						$response['status'] = 'success';
						$response['data']   = self::get_track_info( $data );
					}
				} else {
					$response['data'] = $body['meta']['message'];
				}
			} else {
				$response['code'] = $request_data['code'];
				$response['data'] = $request_data['data'];
			}
		}

		/**
		 * Request single tracking number
		 *
		 * @param $tracking_number
		 * @param $carrier_name
		 * @param string $carrier_code
		 *
		 * @return array
		 */
		public function get_tracking_data( $tracking_number, $carrier_name, $carrier_code = '' ) {
			$response = array(
				'status'              => 'error',
				'est_delivery_date'   => '',
				'origin_country'      => '',
				'destination_country' => '',
				'data'                => esc_html__( 'Tracking not found', 'woocommerce-orders-tracking' ),
				'code'                => '',
			);
			if ( ! $carrier_code && $carrier_name ) {
				$carrier_code = self::get_carrier_slug_by_name( $carrier_name );
			}
			if ( $carrier_code && $tracking_number ) {
				$url          = self::END_POINT . "trackings/$carrier_code/$tracking_number";
				$args         = array(
					'headers' => array(
						self::AUTH_HEADER => $this->api_key,
						'Content-Type'    => 'application/json',
					),
				);
				$request_data = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::wp_remote_get( $url, $args );
				$this->get_tracking_response($response, $request_data,$carrier_code, $tracking_number);
			}

			return $response;
		}

		/**
		 * Carrier package - adjusted to match with defined carrier list of this plugin
		 *
		 * @param bool $json_format
		 *
		 * @return false|mixed|string|null
		 */
		public static function carriers( $json_format = false ) {
			if ( self::$carriers === null ) {
				ini_set( 'memory_limit', - 1 );
				self::$carriers = file_get_contents( VI_WOOCOMMERCE_ORDERS_TRACKING_PACKAGES . 'tracktry-carriers.json' );// phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
			}
			if ( $json_format ) {
				return self::$carriers;
			} else {
				return vi_wot_json_decode( self::$carriers );
			}
		}

		/**
		 * @param $name
		 *
		 * @return bool|int|string
		 */
		public static function get_carrier_slug_by_name( $name ) {
			$carriers = self::carriers();
			$search   = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::array_search_case_insensitive( $name, array_column( $carriers, 'name' ) );

			return $search === false ? '' : $carriers[ $search ]['code'];
		}

		public static function get_carrier_name_by_slug( $slug ) {
			$carriers               = self::carriers();
			$search                 = array_search( $slug, array_column( $carriers, 'code' ) );
			$_tracktry_carrier_name = '';
			if ( $search !== false ) {
				$_tracktry_carrier_name = $carriers[ $search ]['name'];
			}

			return $_tracktry_carrier_name;
		}

		/**
		 * @param $slug
		 *
		 * @return array
		 */
		public static function get_original_carrier_slug( $slug ) {
			$get_carriers   = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_carriers();
			$carriers       = self::carriers();
			$names          = array_column( $get_carriers, 'name' );
			$return         = array();
			$fount_carriers = array_keys( array_column( $carriers, 'code' ), $slug );
			if ( count( $fount_carriers ) ) {
				foreach ( $fount_carriers as $fount_carrier ) {
					$search = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::array_search_case_insensitive( $carriers[ $fount_carrier ]['name'], $names );
					if ( $search !== false ) {
						$return[] = $get_carriers[ $search ]['slug'];
					}
				}
			}

			return $return;
		}

		/**
		 * @param $trackings
		 * @param string $change_order_status
		 *
		 * @throws Exception
		 */
		public static function update_tracking_data( $trackings, $change_order_status = '' ) {
			foreach ( $trackings as $tracking ) {
				$tracking_number = $tracking['tracking_number'];
				$track_info      = self::get_track_info( $tracking );
				$last_event      = $status = '';
				if ( $track_info ) {
					$last_event = $track_info[0]['description'];
					$status     = $track_info[0]['status'];
					$track_info = vi_wot_json_encode( $track_info );
				} else {
					$track_info = '';
				}
				$original_carriers = self::get_original_carrier_slug( $tracking['carrier_code'] );
				if ( count( $original_carriers ) ) {
					foreach ( $original_carriers as $carrier_id ) {
						VI_WOOCOMMERCE_ORDERS_TRACKING_TRACK_INFO_TABLE::update_by_tracking_number( $tracking_number, $carrier_id, 'tracktry', $status, $track_info, $last_event, '', '', '' );
						if ( $status ) {
							VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_ORDERS_TRACK_INFO::update_order_items_tracking_status( $tracking_number, $carrier_id, $status, $change_order_status );
						}
					}
				} else {
					VI_WOOCOMMERCE_ORDERS_TRACKING_TRACK_INFO_TABLE::update_by_tracking_number( $tracking_number, '', 'tracktry', $status, $track_info, $last_event, '', '', '' );
				}
			}
		}

		/**
		 * @param string $status
		 *
		 * @return mixed|string|void
		 */
		public static function map_statuses( $status = '' ) {
			$statuses = apply_filters( 'wot_tracktry_shipment_statuses_mapping', array(
				'pending'     => 'pending',
				'notfound'    => 'alert',
				'transit'     => 'transit',
				'pickup'      => 'pickup',
				'delivered'   => 'delivered',
				'undelivered' => 'alert',
				'exception'   => 'alert',
				'expired'     => 'alert',
			) );
			if ( $status ) {
				$status = strval( $status );

				return isset( $statuses[ $status ] ) ? $statuses[ $status ] : '';
			} else {
				return $statuses;
			}
		}

		/**
		 * @return mixed|void
		 */
		public static function status_text() {
			return apply_filters( 'wot_tracktry_all_shipment_statuses', array(
				'pending'     => esc_html_x( 'Pending', 'tracktry_tracking_status', 'woocommerce-orders-tracking' ),
				'notfound'    => esc_html_x( 'Not found', 'tracktry_tracking_status', 'woocommerce-orders-tracking' ),
				'transit'     => esc_html_x( 'In Transit', 'tracktry_tracking_status', 'woocommerce-orders-tracking' ),
				'pickup'      => esc_html_x( 'PickUp', 'tracktry_tracking_status', 'woocommerce-orders-tracking' ),
				'delivered'   => esc_html_x( 'Delivered', 'tracktry_tracking_status', 'woocommerce-orders-tracking' ),
				'undelivered' => esc_html_x( 'Undelivered', 'tracktry_tracking_status', 'woocommerce-orders-tracking' ),
				'exception'   => esc_html_x( 'Alert', 'tracktry_tracking_status', 'woocommerce-orders-tracking' ),
				'expired'     => esc_html_x( 'Expired', 'tracktry_tracking_status', 'woocommerce-orders-tracking' ),
			) );
		}

		/**
		 * @param $status
		 *
		 * @return mixed|string
		 */
		public static function get_status_text( $status ) {
			$statuses = self::status_text();

			return isset( $statuses[ $status ] ) ? $statuses[ $status ] : '';
		}

		/**
		 * Latest supported carriers
		 *
		 * @return array
		 */
		public function get_carriers() {
			$url          = self::END_POINT . 'carriers';
			$args         = array(
				'headers' => array(
					self::AUTH_HEADER => $this->api_key,
					'Content-Type'    => 'application/json'
				),
			);
			$carriers     = array();
			$request_data = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::wp_remote_get( $url, $args );
			if ( $request_data['status'] === 'success' ) {
				$body = vi_wot_json_decode( $request_data['data'] );
				if ( $body['meta']['code'] == 200 ) {
					$carriers = $body['data'];
				}
			}

			return $carriers;
		}

		/**
		 * Update carrier package
		 */
		public function update_carriers_list() {
			$new_carriers = $this->get_carriers();
			if ( $new_carriers ) {
				$carriers       = self::carriers();
				$carriers_ids   = array_column( $carriers, 'code' );
				$carriers_names = array_column( $carriers, 'name' );
				foreach ( $new_carriers as $new_carrier ) {
					if ( ! empty( $new_carrier['code'] ) ) {
						if ( ! in_array( $new_carrier['code'], $carriers_ids ) || ! in_array( $new_carrier['name'], $carriers_names ) ) {
							$carriers[] = $new_carrier;
						}
					}
				}
				file_put_contents( VI_WOOCOMMERCE_ORDERS_TRACKING_PACKAGES . 'tracktry-carriers.json', vi_wot_json_encode( $carriers ) );// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
			}
		}
	}
}
