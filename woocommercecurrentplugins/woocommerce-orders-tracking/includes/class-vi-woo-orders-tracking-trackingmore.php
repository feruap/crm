<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
if ( ! class_exists( 'VI_WOOCOMMERCE_ORDERS_TRACKING_TRACKINGMORE' ) ) {
	class VI_WOOCOMMERCE_ORDERS_TRACKING_TRACKINGMORE {
		protected $settings;
		protected $service_carrier_api_key;
		protected static $search_tracking_slugs;
		protected static $carriers;

		public function __construct( $service_carrier_api_key ) {
			$this->service_carrier_api_key = $service_carrier_api_key;
		}

		public function create_tracking( $tracking_number, $carrier_slug, $order_id ) {
			$return = array(
				'status'            => 'error',
				'est_delivery_date' => '',
				'code'              => '',
				'data'              => esc_html__( 'Can not create tracker', 'woocommerce-orders-tracking' ),
			);
			if ( $this->service_carrier_api_key ) {
				$url   = self::get_url( 'trackings/post' );
				$order = wc_get_order( $order_id );
				if ( $order ) {
					$language = $order->get_meta( 'wpml_language', true );
					if ( ! $language && function_exists( 'pll_get_post_language' ) ) {
						$language = pll_get_post_language( $order_id );
					}
					$shipping_country = $order->get_shipping_country();
					$tracking         = array(
						/*required*/
						'tracking_number'  => $tracking_number,
						'carrier_code'     => $carrier_slug,
						/*optional*/
						'customer_name'    => $order->get_formatted_billing_full_name(),
						'customer_email'   => $order->get_billing_email(),
						'order_id'         => $order_id,
						'destination_code' => $shipping_country,
						'lang'             => $language ? strtolower( $language ) : 'en',
					);
					$mobile           = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::format_phone_number( $order->get_billing_phone(), $shipping_country );
					if ( $mobile ) {
						$tracking['customer_phone'] = $mobile;
					}
					$args         = array(
						'headers' => array(
							'Content-Type'         => 'application/json',
							'Trackingmore-Api-Key' => $this->service_carrier_api_key,
						),
						'body'    => vi_wot_json_encode( $tracking )
					);
					$request_data = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::wp_remote_post( $url, $args );
					if ( $request_data['status'] === 'success' ) {
						$data = vi_wot_json_decode( $request_data['data'] );
						if ( $data['meta']['code'] == 200 ) {
							$return['status'] = 'success';
							$return['data']   = $data['data'];
						} else {
							$return['code'] = $data['meta']['code'];
							$return['data'] = $data['meta']['message'];
						}
					} else {
						$return['data'] = $request_data['data'];
					}
				} else {
					$return['data'] = esc_html__( 'Order not found', 'woocommerce-orders-tracking' );
				}
			} else {
				$return['data'] = esc_html__( 'Empty API', 'woocommerce-orders-tracking' );
			}

			return $return;
		}

		/**Create multiple trackings
		 * Max 40
		 *
		 * @param $tracking_array
		 *
		 * @return array
		 */
		public function create_multiple_trackings( $tracking_array ) {
			$return = array(
				'status' => 'error',
				'code'   => '',
				'data'   => esc_html__( 'Can not create tracker', 'woocommerce-orders-tracking' ),
			);
			if ( $this->service_carrier_api_key ) {
				$url          = self::get_url( 'trackings/batch' );
				$args         = array(
					'headers' => array(
						'Content-Type'         => 'application/json',
						'Trackingmore-Api-Key' => $this->service_carrier_api_key,
					),
					'body'    => vi_wot_json_encode( $tracking_array )
				);
				$request_data = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::wp_remote_post( $url, $args );
				if ( $request_data['status'] === 'success' ) {
					$data           = vi_wot_json_decode( $request_data['data'] );
					$return['code'] = $data['meta']['code'];
					if ( $data['meta']['code'] == 201 || $data['meta']['code'] == 200 ) {
						$return['status'] = 'success';
						$return['data']   = $data['data'];
					} else {
						$return['data'] = $data['meta']['message'];
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
		 * @param array  $numbers
		 * @param array  $orders
		 * @param string $created_at_min
		 * @param string $created_at_max
		 * @param string $status
		 * @param int    $page
		 * @param int    $limit Items per page - Max 2000
		 *
		 * @return array
		 */
		public function get_multiple_trackings( $numbers = array(), $orders = array(), $created_at_min = '', $created_at_max = '', $status = '', $page = 1, $limit = 2000 ) {
			$return = array(
				'status'            => 'error',
				'est_delivery_date' => '',
				'code'              => '',
				'data'              => '',
			);
			if ( $this->service_carrier_api_key ) {
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
				$url          = add_query_arg( $query_args, self::get_url( 'trackings/get' ) );
				$args         = array(
					'headers' => array(
						'Content-Type'         => 'application/json',
						'Trackingmore-Api-Key' => $this->service_carrier_api_key,
					),
				);
				$request_data = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::wp_remote_get( $url, $args );
				if ( $request_data['status'] === 'success' ) {
					$data           = vi_wot_json_decode( $request_data['data'] );
					$return['code'] = $data['meta']['code'];
					if ( $data['meta']['code'] == 200 ) {
						$return['status'] = 'success';
						$return['data']   = $data['data'];
					} else {
						$return['data'] = $data['meta']['message'];
					}
				} else {
					$return['data'] = $request_data['data'];
				}
			} else {
				$return['data'] = esc_html__( 'Empty API', 'woocommerce-orders-tracking' );
			}

			return $return;
		}

		public static function get_url( $rout ) {
			return "https://api.trackingmore.com/v2/{$rout}";
		}

		/**
		 * @param $tracking_number
		 * @param $carrier_slug
		 *
		 * @return array
		 */
		public function get_tracking( $tracking_number, $carrier_slug ) {
			$response     = array(
				'status'              => 'error',
				'est_delivery_date'   => '',
				'origin_country'      => '',
				'destination_country' => '',
				'data'                => esc_html__( 'Tracking not found', 'woocommerce-orders-tracking' ),
				'code'                => '',
			);
			$url          = self::get_url( "trackings/{$carrier_slug}/{$tracking_number}" );
			$args         = array(
				'headers' => array(
					'Content-Type'         => 'application/json',
					'Trackingmore-Api-Key' => $this->service_carrier_api_key,
				),
			);
			$request_data = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::wp_remote_get( $url, $args );
			if ( $request_data['status'] === 'success' ) {
				$data             = vi_wot_json_decode( $request_data['data'] );
				$response['code'] = $data['meta']['code'];
				if ( $data['meta']['code'] == 200 ) {
					$response['status'] = 'success';
					if ( ! empty( $data['data']['original_country'] ) ) {
						$response['origin_country'] = $data['data']['original_country'];
					}
					if ( ! empty( $data['data']['destination_country'] ) ) {
						$response['destination_country'] = $data['data']['destination_country'];
					}
					$response['data'] = self::process_trackinfo( $data['data'] );
				} else {
					$response['data'] = $data['meta']['message'];
				}
			} else {
				$response['data'] = $request_data['data'];
			}

			return $response;
		}

		/**Search for a tracking number in TrackingMore db, add it to API if not exist
		 *
		 * @param $tracking_number
		 * @param $carrier_slug
		 *
		 * @return array
		 */
		public function post_realtime_tracking( $tracking_number, $carrier_slug ) {
			$response     = array(
				'status'              => 'error',
				'est_delivery_date'   => '',
				'origin_country'      => '',
				'destination_country' => '',
				'data'                => esc_html__( 'Tracking not found', 'woocommerce-orders-tracking' ),
				'code'                => '',
			);
			$url          = self::get_url( 'trackings/realtime' );
			$tracking     = array(
				/*required*/
				'tracking_number' => $tracking_number,
				'carrier_code'    => $carrier_slug,
				'lang'            => 'en',
			);
			$args         = array(
				'headers' => array(
					'Content-Type'         => 'application/json',
					'Trackingmore-Api-Key' => $this->service_carrier_api_key,
				),
				'body'    => vi_wot_json_encode( $tracking )
			);
			$request_data = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::wp_remote_post( $url, $args );
			if ( $request_data['status'] === 'success' ) {
				$data             = vi_wot_json_decode( $request_data['data'] );
				$response['code'] = $data['meta']['code'];
				if ( $data['meta']['code'] == 200 ) {
					$response['status'] = 'success';
					$response['data']   = self::process_trackinfo( $data['data'] );
				} else {
					$response['data'] = $data['meta']['message'];
				}
			} else {
				$response['data'] = $request_data['data'];
			}

			return $response;
		}

		public static function process_trackinfo( $data ) {
			$tracking = $trackinfo = array();
			if ( isset( $data['destination_info'] ) && ! empty( $data['destination_info']['trackinfo'] ) ) {
				$trackinfo = $data['destination_info']['trackinfo'];
			} elseif ( isset( $data['origin_info'] ) && ! empty( $data['origin_info']['trackinfo'] ) ) {
				$trackinfo = $data['origin_info']['trackinfo'];
			}
			if ( count( $trackinfo ) ) {
				foreach ( $trackinfo as $event ) {
					if ( ! empty( $event['Date'] ) ) {
						/*v2*/
						$tracking[] = array(
							'time'        => $event['Date'],
							'description' => isset( $event['StatusDescription'] ) ? $event['StatusDescription'] : '',
							'location'    => isset( $event['Details'] ) ? $event['Details'] : '',
							'status'      => isset( $event['checkpoint_status'] ) ? $event['checkpoint_status'] : '',
						);
					} elseif ( ! empty( $event['checkpoint_date'] ) ) {
						/*v3*/
						$tracking[] = array(
							'time'        => $event['checkpoint_date'],
							'description' => isset( $event['tracking_detail'] ) ? $event['tracking_detail'] : '',
							'location'    => isset( $event['location'] ) ? $event['location'] : '',
							'status'      => isset( $event['checkpoint_delivery_status'] ) ? $event['checkpoint_delivery_status'] : '',
						);
					}
				}
			}

			return $tracking;
		}

		public function get_carriers() {
			$response = array(
				'status'            => 'error',
				'est_delivery_date' => '',
				'code'              => '',
				'data'              => esc_html__( 'Empty API key', 'woocommerce-orders-tracking' ),
			);
			if ( $this->service_carrier_api_key ) {
				$url          = self::get_url( 'carriers' );
				$args         = array(
					'headers' => array(
						'Content-Type'         => 'application/json',
						'Trackingmore-Api-Key' => $this->service_carrier_api_key,
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
			}

			return $response;
		}

		/**
		 * @param bool $json_format
		 *
		 * @return mixed|string|null
		 */
		public static function carriers( $json_format = false ) {
			if ( self::$carriers === null ) {
				ini_set( 'memory_limit', - 1 );
				self::$carriers = file_get_contents( VI_WOOCOMMERCE_ORDERS_TRACKING_PACKAGES . 'trackingmore-carriers.json' );// phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
			}
			if ( $json_format ) {
				return self::$carriers;
			} else {
				return vi_wot_json_decode( self::$carriers );
			}
		}

		public static function get_carrier_slug_by_name( $name ) {
			if ( function_exists( 'str_ireplace' ) ) {
				$name = trim( str_ireplace( array( 'tracking', 'track' ), '', $name ) );
			}
			$carriers = self::carriers();
			$search   = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::array_search_case_insensitive( $name, array_column( $carriers, 'name' ) );
			$slug     = false;
			if ( $search !== false ) {
				$slug = $carriers[ $search ]['code'];
			}

			return $slug;
		}

		public static function get_carrier_slug_by_trackingmore_slug( $slug ) {
			if ( self::$search_tracking_slugs === null ) {
				self::$search_tracking_slugs = array();
			} elseif ( isset( self::$search_tracking_slugs[ $slug ] ) ) {
				return self::$search_tracking_slugs[ $slug ];
			}

			$get_carriers = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_carriers();
			$search       = array_search( $slug, array_column( $get_carriers, 'tracking_more_slug' ) );
			$return       = '';
			if ( $search !== false ) {
				$return = $get_carriers[ $search ]['slug'];
			} else {
				$carriers = self::carriers();
				$search   = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::array_search_case_insensitive( $slug, array_column( $carriers, 'code' ) );
				if ( $search !== false ) {
					$search = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::array_search_case_insensitive( $carriers[ $search ]['name'], array_column( $get_carriers, 'name' ) );
					if ( $search !== false ) {
						$return = $get_carriers[ $search ]['slug'];
					}
				}
			}
			self::$search_tracking_slugs[ $slug ] = $return;

			return $return;
		}

		/**
		 * @param        $trackings
		 * @param string $change_order_status
		 *
		 * @throws Exception
		 */
		public static function update_tracking_data( $trackings, $change_order_status = '' ) {
			foreach ( $trackings as $tracking ) {
				$tracking_number = $tracking['tracking_number'];
				$track_info      = self::process_trackinfo( $tracking );
				if ( $track_info ) {
					$track_info = vi_wot_json_encode( $track_info );
				} else {
					$track_info = '';
				}
				$last_event = $tracking['lastEvent'];
				$status     = $tracking['status'];
				$carrier_id = $tracking['carrier_code'];
				VI_WOOCOMMERCE_ORDERS_TRACKING_TRACKINGMORE_TABLE::update_by_tracking_number( $tracking_number, $status, self::get_carrier_slug_by_trackingmore_slug( $carrier_id ),
					false, false, $track_info, $last_event );
				if ( $status ) {
					VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_ORDERS_TRACK_INFO::update_order_items_tracking_status( $tracking_number,
						self::get_carrier_slug_by_trackingmore_slug( $carrier_id ), $status, $change_order_status );
				}
			}
		}

		public static function map_statuses( $status = '' ) {
			$statuses = apply_filters( 'wot_trackingmore_shipment_statuses_mapping', array(
				'pending'     => 'pending',
				'notfound'    => 'pending',
				'pickup'      => 'pickup',
				'transit'     => 'transit',
				'delivered'   => 'delivered',
				'exception'   => 'alert',
				'expired'     => 'alert',
				'undelivered' => 'alert',
			) );
			if ( $status ) {
				return isset( $statuses[ $status ] ) ? $statuses[ $status ] : '';
			} else {
				return $statuses;
			}
		}

		public static function status_text() {
			return apply_filters( 'wot_trackingmore_all_shipment_statuses', array(
				'pending'     => esc_html_x( 'Pending', 'trackingmore_tracking_status', 'woocommerce-orders-tracking' ),
				'notfound'    => esc_html_x( 'Not Found', 'trackingmore_tracking_status', 'woocommerce-orders-tracking' ),
				'pickup'      => esc_html_x( 'Out for Delivery', 'trackingmore_tracking_status', 'woocommerce-orders-tracking' ),
				'transit'     => esc_html_x( 'Transit', 'trackingmore_tracking_status', 'woocommerce-orders-tracking' ),
				'delivered'   => esc_html_x( 'Delivered', 'trackingmore_tracking_status', 'woocommerce-orders-tracking' ),
				'exception'   => esc_html_x( 'Exception', 'trackingmore_tracking_status', 'woocommerce-orders-tracking' ),
				'expired'     => esc_html_x( 'Expired', 'trackingmore_tracking_status', 'woocommerce-orders-tracking' ),
				'undelivered' => esc_html_x( 'Undelivered', 'trackingmore_tracking_status', 'woocommerce-orders-tracking' ),
			) );
		}

		public static function get_status_text( $status ) {
			$statuses = self::status_text();

			return isset( $statuses[ $status ] ) ? $statuses[ $status ] : '';
		}
	}
}
