<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
if ( ! class_exists( 'VI_WOOCOMMERCE_ORDERS_TRACKING_17TRACK' ) ) {
	class VI_WOOCOMMERCE_ORDERS_TRACKING_17TRACK {
		const END_POINT = 'https://api.17track.net/track/v2/';
		const AUTH_HEADER = '17token';
		protected $settings;
		protected $service_carrier_api_key;
		protected static $countries, $carriers;

		public function __construct( $service_carrier_api_key ) {
			$this->service_carrier_api_key = $service_carrier_api_key;
		}

		/**
		 * Register multiple tracking numbers, maximum 40 per request
		 *
		 * @param $trackings array
		 *
		 * @return array
		 */
		public function create( $trackings ) {
			$return = array(
				'status'            => 'error',
				'est_delivery_date' => '',
				'code'              => '',
				'data'              => '',
			);
			if ( ! is_array( $trackings ) || count( $trackings ) >= 40 ) {
				$return['data'] = esc_html__( 'Maximum 40 tracking numbers per request', 'woocommerce-orders-tracking' );

				return $return;
			}
			if ( $this->service_carrier_api_key ) {
				$trackings_ = array();
				foreach ( $trackings as &$tracking ) {
					$tracking['status']          = 'error';
					$tracking['message']         = '';
					$tracking['17track_carrier'] = '';
					$tracking_                   = array(
						'number'  => isset( $tracking['tracking_number'] ) ? $tracking['tracking_number'] : '',
						'carrier' => '',
					);
					if ( ! empty( $tracking['carrier_name'] ) ) {
						$tracking_['carrier']        = self::get_carrier_slug_by_name( $tracking['carrier_name'] );
						$tracking['17track_carrier'] = $tracking_['carrier'];
//						if ( $tracking_['carrier'] && ! empty( $tracking['order_id'] ) ) {
//							$param = self::get_additional_para( $tracking_['carrier'], $tracking['order_id'] );
//							if ( $param ) {
//								$tracking_['param'] = $param;
//							}
//						}
					} else {
						$tracking['carrier_name'] = '';
					}
//				if ( empty( $tracking['carrier_name'] ) ) {
//					$tracking_['auto_detection'] = true;
//				} else {
//					$detect_carrier = self::get_carrier_slug_by_name( $tracking_['carrier_name'] );
//					if ( $detect_carrier ) {
//						$tracking_['carrier'] = self::get_carrier_slug_by_name( $tracking_['carrier_name'] );
//					}else{
//						$tracking_['auto_detection'] = true;
//					}
//				}
					if ( ! empty( $tracking['tag'] ) ) {
						$tracking_['tag'] = $tracking['tag'];
					}
					$trackings_[] = $tracking_;
				}
				$url          = self::END_POINT . 'register';
				$args         = array(
					'headers' => array(
						self::AUTH_HEADER => $this->service_carrier_api_key,
						'Content-Type'    => 'application/json',
					),
					'body'    => vi_wot_json_encode( $trackings_ )
				);
				$request_data = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::wp_remote_post( $url, $args );
				if ( $request_data['status'] === 'success' ) {
					$body             = vi_wot_json_decode( $request_data['data'] );
					$return['status'] = 'success';
					$accepted         = isset( $body['data']['accepted'] ) ? $body['data']['accepted'] : array();
					$rejected         = isset( $body['data']['rejected'] ) ? $body['data']['rejected'] : array();
					if ( count( $accepted ) ) {
						foreach ( $accepted as $key => $value ) {
							foreach ( $trackings_ as $key_1 => $value_1 ) {
								if ( $value['number'] === $value_1['number'] ) {
									if ( ! $value_1['carrier'] ) {
										$trackings[ $key_1 ]['status']          = 'success';
										$trackings[ $key_1 ]['17track_carrier'] = $value['carrier'];
										break;
									} elseif ( $value['carrier'] === $value_1['carrier'] ) {
										$trackings[ $key_1 ]['status'] = 'success';
										break;
									}
								}
							}
						}
					}
					if ( count( $rejected ) ) {
						foreach ( $rejected as $key => $value ) {
							foreach ( $trackings_ as $key_1 => $value_1 ) {
								if ( $trackings[ $key_1 ]['status'] === 'error' && $value['number'] === $value_1['number'] ) {
									if ( - 18019901 == $value['error']['code'] ) {
										$trackings[ $key_1 ]['status'] = 'exist';
									}
									$trackings[ $key_1 ]['message'] = $value['error']['message'];
									$trackings[ $key_1 ]['code']    = $value['error']['code'];
									break;
								}
							}
						}
					}
					$return['data'] = $trackings;
				} else {
					$return['data'] = $request_data['data'];
				}
			} else {
				$return['data'] = esc_html__( 'Empty API', 'woocommerce-orders-tracking' );
			}

			return $return;
		}

		/**
		 * Request multiple tracking numbers, maximum 40 per request
		 *
		 * @param $trackings
		 *
		 * @return array
		 */
		public function request_tracking_data( $trackings ) {
			$return = array(
				'status' => 'error',
				'code'   => '',
				'data'   => '',
			);
			if ( ! is_array( $trackings ) || count( $trackings ) >= 40 ) {
				$return['data'] = esc_html__( 'Maximum 40 tracking numbers per request', 'woocommerce-orders-tracking' );

				return $return;
			}
			if ( $this->service_carrier_api_key ) {
				$trackings_ = array();
				foreach ( $trackings as &$tracking ) {
					$tracking['status']            = 'error';
					$tracking['message']           = '';
					$tracking['est_delivery_date'] = '';
					$tracking['17track_carrier']   = '';
					$tracking_                     = array(
						'number' => isset( $tracking['tracking_number'] ) ? $tracking['tracking_number'] : '',
					);
					if ( ! empty( $tracking['carrier'] ) ) {
						$tracking_['carrier']        = $tracking['carrier'];
						$tracking['17track_carrier'] = $tracking['carrier'];
					} else {
						if ( ! empty( $tracking['carrier_name'] ) ) {
							$tracking_['carrier']        = self::get_carrier_slug_by_name( $tracking['carrier_name'] );
							$tracking['17track_carrier'] = $tracking_['carrier'];
						} else {
							$tracking['carrier_name'] = '';
						}
					}
//					if ( ! empty( $tracking_['carrier'] ) && ! empty( $tracking['order_id'] ) ) {
//						$param = self::get_additional_para( $tracking_['carrier'], $tracking['order_id'] );
//						if ( $param ) {
//							$tracking_['param'] = $param;
//						}
//					}
					$trackings_[] = $tracking_;
				}
				$url          = self::END_POINT . 'gettrackinfo';
				$args         = array(
					'headers' => array(
						self::AUTH_HEADER => $this->service_carrier_api_key,
						'Content-Type'    => 'application/json',
					),
					'body'    => vi_wot_json_encode( $trackings_ )
				);
				$request_data = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::wp_remote_post( $url, $args );
				if ( $request_data['status'] === 'success' ) {
					$return['status'] = 'success';
					$body             = vi_wot_json_decode( $request_data['data'] );
					$accepted         = isset( $body['data']['accepted'] ) ? $body['data']['accepted'] : array();
					$rejected         = isset( $body['data']['rejected'] ) ? $body['data']['rejected'] : array();
					if ( count( $accepted ) ) {
						foreach ( $accepted as $key => $value ) {
							$track = $value['track_info'];
							foreach ( $trackings_ as $key_1 => $value_1 ) {
								if ( $value['number'] === $value_1['number'] ) {
									if ( empty( $value_1['carrier'] ) || $value_1['carrier'] == $value['carrier'] ) {
										$trackings[ $key_1 ]['status']              = 'success';
										$trackings[ $key_1 ]['origin_country']      = isset( $track['shipping_info']['shipper_address']['country'] ) ? $track['shipping_info']['shipper_address']['country'] : '';
										$trackings[ $key_1 ]['destination_country'] = isset( $track['shipping_info']['recipient_address']['country'] ) ? $track['shipping_info']['recipient_address']['country'] : '';
										$trackings[ $key_1 ]['data']                = self::get_track_info( $track['tracking'], true, isset( $track['latest_status']['status'] ) ? $track['latest_status']['status'] : '', $value_1['carrier']??'' );
										if ( count( $trackings[ $key_1 ]['data'] ) ) {
											if ( empty( $trackings[ $key_1 ]['data'][0]['status'] ) ) {
												if ( ! empty( $track['latest_status']['status'] ) ) {
													$trackings[ $key_1 ]['data'][0]['status'] = $track['latest_status']['status'];
												}
											}
										}
										if ( ! empty( $track['shipping_info']['time_metrics']['estimated_delivery_date']['from'] ) ) {
											$trackings[ $key_1 ]['est_delivery_date'] = $track['shipping_info']['time_metrics']['estimated_delivery_date']['from'];
										} elseif ( ! empty( $track['shipping_info']['time_metrics']['estimated_delivery_date']['to'] ) ) {
											$trackings[ $key_1 ]['est_delivery_date'] = $track['shipping_info']['time_metrics']['estimated_delivery_date']['to'];
										}
										break;
									}
								}
							}
						}
					}
					self::handle_rejected_tracking_numbers( $rejected, $trackings_, $trackings );
					$return['data'] = $trackings;
				} else {
					$return['data'] = $request_data['data'];
				}
			} else {
				$return['data'] = esc_html__( 'Empty API', 'woocommerce-orders-tracking' );
			}

			return $return;
		}

		public function get_track_list( $register_time_from = '', $register_time_to = '', $page_no = 1 ) {
			$return = array(
				'status' => 'error',
				'code'   => '',
				'data'   => '',
				'page'   => '',
			);
			if ( $this->service_carrier_api_key ) {
				$trackings_ = array(
					'push_status'     => 'Success',
					'tracking_status' => 'Tracking',
					'order_by'        => 'RegisterTimeAsc',
					'page_no'         => $page_no,
				);
				if ( $register_time_from ) {
					$trackings_['register_time_from'] = $register_time_from;
				}
				if ( $register_time_to ) {
					$trackings_['register_time_to'] = $register_time_to;
				}
				$url          = self::END_POINT . 'gettracklist';
				$args         = array(
					'headers' => array(
						self::AUTH_HEADER => $this->service_carrier_api_key,
						'Content-Type'    => 'application/json',
					),
					'body'    => vi_wot_json_encode( $trackings_ )
				);
				$request_data = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::wp_remote_post( $url, $args );
				if ( $request_data['status'] === 'success' ) {
					$return['status'] = 'success';
					$body             = vi_wot_json_decode( $request_data['data'] );
					if ( isset( $body['data']['errors'] ) ) {
						$return['code'] = $body['data']['errors'][0]['code'];
						$return['data'] = $body['data']['errors'][0]['message'];
					} else {
						$return['status'] = 'success';
						$return['page']   = $body['page'];
						$return['data']   = $body['data']['accepted'];
					}
				} else {
					$return['data'] = $request_data['data'];
				}
			} else {
				$return['data'] = esc_html__( 'Empty API', 'woocommerce-orders-tracking' );
			}

			return $return;
		}

		/**
		 * @param $tracking
		 * @param bool $v2
		 * @param string $latest_status
		 *
		 * @return array
		 */
		public static function get_track_info( $tracking, $v2 = true, $latest_status = '', $carrier_id= '' ) {
			$track_info = array();
			if ( $v2 ) {
				$key = 0;
				if ($carrier_id && isset($tracking['providers']) && is_array($tracking['providers'])){
					foreach ($tracking['providers'] as $k => $provider ){
						if (isset($provider['provider']['key']) && $provider['provider']['key'] == $carrier_id){
							$key = $k;
						}
					}
				}
				if ( isset( $tracking['providers'][$key]['events'] ) ) {
					if ( is_array( $tracking['providers'][$key]['events'] ) && count( $tracking['providers'][$key]['events'] ) ) {
						foreach ( $tracking['providers'][$key]['events'] as $event ) {
							$track_info[] = array(
								'time'        => $event['time_iso'],
								'description' => $event['description'],
								'location'    => $event['location'],
								'status'      => $event['stage'],
							);
						}
						if ( empty( $track_info[$key]['status'] ) ) {
							$track_info[$key]['status'] = $latest_status;
						}
					}
				}
			} else {
				if ( is_array( $tracking ) && count( $tracking ) ) {
					foreach ( $tracking as $tracking_item ) {
						$track_info[] = array(
							'time'        => $tracking_item['a'],
							'description' => $tracking_item['z'],
							'location'    => $tracking_item['c'],
							'status'      => '',
						);
					}
				}
			}

			return array_values( $track_info );
		}

		/**
		 * Request single tracking number
		 *
		 * @param $tracking_number
		 * @param string $carrier_name
		 *
		 * @return array
		 */
		public function get_tracking_data( $tracking_number, $carrier_name = '' ) {
			$response     = array(
				'status'              => 'error',
				'est_delivery_date'   => '',
				'origin_country'      => '',
				'destination_country' => '',
				'data'                => esc_html__( 'Tracking not found', 'woocommerce-orders-tracking' ),
				'code'                => '',
			);
			$request_data = $this->request_tracking_data( array(
				array(
					'tracking_number' => $tracking_number,
					'carrier_name'    => $carrier_name
				)
			) );

			if ( $request_data['status'] === 'success' ) {
				$response = array_merge( $response, $request_data['data'][0] );
//				if ( $request_data['data'][0]['status'] === 'success' ) {
//				}else {
//					$response['code'] = $request_data['data'][0]['code'];
//					$response['data'] = $request_data['data'][0]['message'];
//				}
			} else {
				$response['code'] = $request_data['code'];
				$response['data'] = $request_data['data'];
			}

			return $response;
		}

		public static function countries() {
			if ( self::$countries === null ) {
				ini_set( 'memory_limit', - 1 );

//				ob_start();
//				require_once VI_WOOCOMMERCE_ORDERS_TRACKING_PACKAGES . '17track-countries.json';
//				self::$countries = ob_get_clean();

				self::$countries = file_get_contents( VI_WOOCOMMERCE_ORDERS_TRACKING_PACKAGES . '17track-countries.json' );// phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents

				self::$countries = vi_wot_json_decode( self::$countries );
			}

			return self::$countries;
		}

		/**
		 * @param $code
		 * @param bool $_17track
		 *
		 * @return string
		 */
		public static function get_country_code( $code, $_17track = true ) {
			if ( ! $code ) {
				return '';
			}
			$countries = self::countries();
			if ( $_17track ) {
				$search = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::array_search_case_insensitive( $code, array_column( $countries, 'code' ) );

				return $search === false ? '' : $countries[ $search ]['key'];
			} else {
				$search = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::array_search_case_insensitive( $code, array_column( $countries, 'key' ) );

				return $search === false ? '' : $countries[ $search ]['code'];
			}
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
				self::$carriers = file_get_contents( VI_WOOCOMMERCE_ORDERS_TRACKING_PACKAGES . '17track-carriers.json' );// phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
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
			$search   = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::array_search_case_insensitive( $name, array_column( $carriers, '_name' ) );

			return $search === false ? '' : $carriers[ $search ]['key'];
		}

		public static function get_carrier_name_by_slug( $slug ) {
			$carriers              = self::carriers();
			$search                = array_search( $slug, array_column( $carriers, 'key' ) );
			$_17track_carrier_name = '';
			if ( $search !== false ) {
				$_17track_carrier_name = $carriers[ $search ]['_name'];
			}

			return $_17track_carrier_name;
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
			$fount_carriers = array_keys( array_column( $carriers, 'key' ), $slug );
			if ( count( $fount_carriers ) ) {
				foreach ( $fount_carriers as $fount_carrier ) {
					$search = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::array_search_case_insensitive( $carriers[ $fount_carrier ]['_name'], $names );
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
				if ( $tracking['status'] === 'success' ) {
					$tracking_number = $tracking['tracking_number'];
					$track_info      = $tracking['data'];
					$last_event      = $status = '';
					if ( $track_info ) {
						$last_event = $track_info[0]['description'];
						$status     = $track_info[0]['status'];
						$track_info = vi_wot_json_encode( $track_info );
					} else {
						$track_info = '';
					}
					$original_carriers = self::get_original_carrier_slug( $tracking['carrier'] );
					if ( count( $original_carriers ) ) {
						foreach ( $original_carriers as $carrier_id ) {
							VI_WOOCOMMERCE_ORDERS_TRACKING_TRACK_INFO_TABLE::update_by_tracking_number( $tracking_number, $carrier_id, '17track', $status, $track_info, $last_event, $tracking['est_delivery_date'], $tracking['origin_country'], $tracking['destination_country'] );
							if ( $status ) {
								VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_ORDERS_TRACK_INFO::update_order_items_tracking_status( $tracking_number, $carrier_id, $status, $change_order_status );
							}
						}
					} else {
						VI_WOOCOMMERCE_ORDERS_TRACKING_TRACK_INFO_TABLE::update_by_tracking_number( $tracking_number, '', '17track', $status, $track_info, $last_event, $tracking['est_delivery_date'], $tracking['origin_country'], $tracking['destination_country'] );
					}
				}
			}
		}

		/**
		 * @param string $status
		 *
		 * @return mixed|string|void
		 */
		public static function map_statuses( $status = '' ) {
			$statuses = apply_filters( 'wot_17track_shipment_statuses_mapping', array(
				'notfound'           => 'pending',
				'inforeceived'       => 'pending',
				'pickedup'           => 'pickup',
				'departure'          => 'pickup',
				'arrival'            => 'pickup',
				'availableforpickup' => 'pickup',
				'outfordelivery'     => 'transit',
				'intransit'          => 'transit',
				'delivered'          => 'delivered',
				'returned'           => 'alert',
				'returning'          => 'alert',
				'deliveryfailure'    => 'alert',
				'exception'          => 'alert',
				'expired'            => 'alert',
			) );
			if ( $status ) {
				$status = strval( $status );

				return isset( $statuses[ $status ] ) ? $statuses[ $status ] : '';
			} else {
				return $statuses;
			}
		}

		/**
		 * @param string $status
		 * @param bool $revert
		 *
		 * @return array|mixed|string
		 */
		public static function convert_v1_statuses( $status = '', $revert = false ) {
			$statuses = array(
				'0'  => 'notfound',
				'10' => 'intransit',
				'20' => 'expired',
				'30' => 'pickedup',
				'35' => 'deliveryfailure',
				'40' => 'delivered',
				'50' => 'exception',
			);
			if ( $revert ) {
				$statuses = array_flip( $statuses );
			}
			$status = strval( $status );
			if ( $status !== '' ) {
				if ( isset( $statuses[ $status ] ) ) {
					$status = $statuses[ $status ];
				}

				return $status;
			} else {
				return $statuses;
			}
		}

		/**
		 * @return mixed|void
		 */
		public static function status_text() {
			return apply_filters( 'wot_17track_all_shipment_statuses', array(
				'notfound'        => esc_html_x( 'Not found', '17track_tracking_status', 'woocommerce-orders-tracking' ),
				'inforeceived'    => esc_html_x( 'Info Received', '17track_tracking_status', 'woocommerce-orders-tracking' ),
				'intransit'       => esc_html_x( 'In Transit', '17track_tracking_status', 'woocommerce-orders-tracking' ),
				'expired'         => esc_html_x( 'Expired', '17track_tracking_status', 'woocommerce-orders-tracking' ),
				'pickedup'        => esc_html_x( 'PickedUp', '17track_tracking_status', 'woocommerce-orders-tracking' ),
				'outfordelivery'  => esc_html_x( 'Out For Delivery', '17track_tracking_status', 'woocommerce-orders-tracking' ),
				'deliveryfailure' => esc_html_x( 'Undelivered', '17track_tracking_status', 'woocommerce-orders-tracking' ),
				'delivered'       => esc_html_x( 'Delivered', '17track_tracking_status', 'woocommerce-orders-tracking' ),
				'exception'       => esc_html_x( 'Alert', '17track_tracking_status', 'woocommerce-orders-tracking' ),
				/*Some other statuses*/
//				'departure'          => esc_html_x( 'Departure', '17track_tracking_status', 'woocommerce-orders-tracking' ),
//				'arrival'            => esc_html_x( 'Arrival', '17track_tracking_status', 'woocommerce-orders-tracking' ),
//				'availableforpickup' => esc_html_x( 'Available For Pickup', '17track_tracking_status', 'woocommerce-orders-tracking' ),
//				'returned'           => esc_html_x( 'Returned', '17track_tracking_status', 'woocommerce-orders-tracking' ),
//				'returning'          => esc_html_x( 'Returning', '17track_tracking_status', 'woocommerce-orders-tracking' ),
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
		 * Latest supported carriers by 17track
		 *
		 * @return array
		 */
		public static function get_carriers() {
			return VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::wp_remote_get( 'https://res.17track.net/asset/carrier/info/carrier.all.json' );
		}

		/**
		 * Update carrier package
		 */
		public static function update_carriers_list() {
			$get_new_carriers = self::get_carriers();
			if ( $get_new_carriers['status'] === 'success' ) {
				$new_carriers = $get_new_carriers['data'];
				if ( $new_carriers ) {
					$new_carriers = vi_wot_json_decode( $new_carriers );
					if ( is_array( $new_carriers ) ) {
						$carriers       = self::carriers();
						$carriers_ids   = array_column( $carriers, 'key' );
						$carriers_names = array_column( $carriers, '_name' );
						foreach ( $new_carriers as $new_carrier ) {
							if ( ! empty( $new_carrier['key'] ) ) {
								if ( ! in_array( $new_carrier['key'], $carriers_ids ) || ! in_array( $new_carrier['_name'], $carriers_names ) ) {
									$carriers[] = $new_carrier;
								}
							}
						}
						file_put_contents( VI_WOOCOMMERCE_ORDERS_TRACKING_PACKAGES . '17track-carriers.json', vi_wot_json_encode( $carriers ) );// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
					}
				}
			}
		}

		/**
		 * @param $trackings
		 *
		 * @return array
		 */
		public function change_carrier( $trackings ) {
			$return = array(
				'status' => 'error',
				'code'   => '',
				'data'   => '',
			);
			if ( ! is_array( $trackings ) || count( $trackings ) >= 40 ) {
				$return['data'] = esc_html__( 'Maximum 40 tracking numbers per request', 'woocommerce-orders-tracking' );

				return $return;
			}
			if ( $this->service_carrier_api_key ) {
				$trackings_ = array();
				foreach ( $trackings as &$tracking ) {
					$tracking['status']          = 'error';
					$tracking['message']         = '';
					$tracking['17track_carrier'] = '';
					$tracking_                   = array(
						'number' => isset( $tracking['tracking_number'] ) ? $tracking['tracking_number'] : '',
					);
					if ( ! empty( $tracking['old_carrier_name'] ) ) {
						$tracking_['carrier_old'] = self::get_carrier_slug_by_name( $tracking['old_carrier_name'] );
					}
					if ( ! empty( $tracking['carrier_name'] ) ) {
						$tracking_['carrier_new']    = self::get_carrier_slug_by_name( $tracking['carrier_name'] );
						$tracking['17track_carrier'] = $tracking_['carrier'];
					} else {
						$tracking['carrier_name'] = '';
					}
					$trackings_[] = $tracking_;
				}
				$url          = self::END_POINT . 'changecarrier';
				$args         = array(
					'headers' => array(
						self::AUTH_HEADER => $this->service_carrier_api_key,
						'Content-Type'    => 'application/json',
					),
					'body'    => vi_wot_json_encode( $trackings_ )
				);
				$request_data = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::wp_remote_post( $url, $args );
				if ( $request_data['status'] === 'success' ) {
					$return['status'] = 'success';
					$body             = vi_wot_json_decode( $request_data['data'] );
					$accepted         = isset( $body['data']['accepted'] ) ? $body['data']['accepted'] : array();
					$rejected         = isset( $body['data']['rejected'] ) ? $body['data']['rejected'] : array();
					if ( count( $accepted ) ) {
						foreach ( $accepted as $key => $value ) {
							foreach ( $trackings_ as $key_1 => $value_1 ) {
								if ( $value['number'] === $value_1['number'] ) {
									if ( $value_1['carrier'] == $value['carrier_new'] ) {
										$trackings[ $key_1 ]['status'] = 'success';
									}
								}
							}
						}
					}
					self::handle_rejected_tracking_numbers( $rejected, $trackings_, $trackings );
					$return['data'] = $trackings;
				} else {
					$return['data'] = $request_data['data'];
				}
			} else {
				$return['data'] = esc_html__( 'Empty API', 'woocommerce-orders-tracking' );
			}

			return $return;
		}

		/**
		 * @param $rejected
		 * @param $trackings_
		 * @param $trackings
		 */
		private static function handle_rejected_tracking_numbers( $rejected, $trackings_, &$trackings ) {
			if ( count( $rejected ) ) {
				foreach ( $rejected as $key => $value ) {
					foreach ( $trackings_ as $key_1 => $value_1 ) {
						if ( $trackings[ $key_1 ]['status'] === 'error' && $value['number'] === $value_1['number'] ) {
							$trackings[ $key_1 ]['message'] = $value['error']['message'];
							$trackings[ $key_1 ]['code']    = $value['error']['code'];
							break;
						}
					}
				}
			}
		}

		/**
		 * https://asset.17track.net/api/document/v2_en/#additional-parameters-for-tracking
		 *
		 * @param $_17track_carrier_code
		 * @param $order_id
		 *
		 * @return false|string
		 */
		public static function get_additional_para( $_17track_carrier_code, $order_id ) {
			$additional_para = '';
			$para_types      = array(
				'2061'   => 'postal_code',//PostalCode
				'100484' => 'postal_code',
				'100466' => 'postal_code',
				'100431' => 'postal_code',
				'100189' => 'postal_code',
				'100384' => 'postal_code',
				'100594' => 'postal_code',
				'100304' => 'postal_code',
				'100436' => 'postal_code',
				'100364' => 'postal_code',
				'100394' => 'postal_code',
				'14041'  => 'country_postal_code',//Country code & PostalCode
				'100522' => 'postal_code',
				'100167' => 'postal_code',
				'100524' => 'postal_code',
				'100580' => 'postal_code',
				'3011'   => '4_digits_phone_number'//Last 4 digits of the phone number
			);
			if ( isset( $para_types[ $_17track_carrier_code ] ) ) {
				$order = wc_get_order( $order_id );
				if ( $order ) {
					switch ( $para_types[ $_17track_carrier_code ] ) {
						case 'postal_code':
							/*According to a customer, postal code here is origin postal code, not destination*/
							break;
						case 'country_postal_code':

							break;
						case '4_digits_phone_number':

							break;
						default:
					}
				}
			}

			return $additional_para;
		}
	}
}
