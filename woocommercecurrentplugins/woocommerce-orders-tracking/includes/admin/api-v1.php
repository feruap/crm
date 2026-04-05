<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! class_exists( 'VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_API_V1' ) ) {
	class VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_API_V1 {
		protected static $settings;
		protected $namespace;
		protected $carriers;

		public function __construct() {
			$this->namespace = 'woo-orders-tracking/v1';
			$this->carriers  = array();
			self::$settings  = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_instance();
			add_action( 'rest_api_init', array( $this, 'register_api' ) );
			add_filter( 'woocommerce_rest_is_request_to_rest_api', array(
				$this,
				'woocommerce_rest_is_request_to_rest_api'
			) );
		}

		public function woocommerce_rest_is_request_to_rest_api( $is_request_to_rest_api ) {
			$rest_prefix = trailingslashit( rest_get_url_prefix() );
			$request_uri = esc_url_raw( wp_unslash( $_SERVER['REQUEST_URI'] ) );
			if ( false !== strpos( $request_uri, $rest_prefix . "{$this->namespace}/" ) ) {
				$is_request_to_rest_api = true;
			}

			return $is_request_to_rest_api;
		}

		/**
		 * Register REST API
		 */
		public function register_api() {
			/*Set tracking numbers for an order*/
			register_rest_route(
				$this->namespace, '/tracking/set', array(
					'methods'             => WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'set_tracking_numbers' ),
					'permission_callback' => array( $this, 'edit_item_permissions_check' ),
				)
			);
			/*Get tracking numbers for an order*/
			register_rest_route(
				$this->namespace, '/tracking/get', array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( $this, 'get' ),
					'permission_callback' => array( $this, 'get_item_permissions_check' ),
				)
			);
		}

		/**
		 * @param $request WP_REST_Request
		 *
		 * @return WP_Error|WP_REST_Response
		 * @throws Exception
		 */
		public function get( $request ) {
			$order = wc_get_order( (int) $request->get_param( 'order_id' ) );
			if ( ! $order ) {
				return new WP_Error( 'wot_order_invalid', __( 'Invalid order', 'woocommerce-orders-tracking' ), array( 'status' => 404 ) );
			}

			return rest_ensure_response( VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_tracking_numbers( $order->get_id(), (bool) $request->get_param( 'empty_tracking' ) ) );
		}

		/**
		 * @param $request WP_REST_Request
		 *
		 * @return WP_Error|WP_REST_Response
		 * @throws Exception
		 */
		public function set_tracking_numbers( $request ) {
			$order = wc_get_order( (int) $request->get_param( 'order_id' ) );
			if ( ! $order ) {
				return new WP_Error( 'wot_order_invalid', esc_html__( 'Invalid order', 'woocommerce-orders-tracking' ), array( 'status' => 404 ) );
			}
			$send_email          = $request->get_param( 'send_email' );
			$send_sms            = $request->get_param( 'send_sms' );
			$change_order_status = $request->get_param( 'change_order_status' );
			$order_id            = $order->get_id();
			$tracking_data       = $request->get_param( 'tracking_data' );
			$results             = array();
			$paypal_orders       = array();
			if ( ! is_array( $tracking_data ) || ! count( $tracking_data ) ) {
				return new WP_Error( 'wot_tracking_data_invalid', esc_html__( 'Invalid tracking data', 'woocommerce-orders-tracking' ), array( 'status' => 400 ) );
			}
			$service_carrier_enable       = self::$settings->get_params( 'service_carrier_enable' );
			$service_carrier_type         = self::$settings->get_params( 'service_carrier_type' );
			$track_per_quantity = self::$settings->get_params( 'track_per_quantity' );
			$bulk_tracking_service_orders = array();
			$processed_items              = array();
			$updated_items_count          = 0;
			for ( $i = 0; $i < count( $tracking_data ); $i ++ ) {
				$new_tracking    = $tracking_data[ $i ];
				$item_id         = isset( $new_tracking['item_id'] ) ? $new_tracking['item_id'] : '';
				$tracking_number = isset( $new_tracking['tracking_number'] ) ? $new_tracking['tracking_number'] : '';
				$carrier_slug    = isset( $new_tracking['carrier_slug'] ) ? $new_tracking['carrier_slug'] : '';
				$add_to_paypal   = isset( $new_tracking['add_to_paypal'] ) ? $new_tracking['add_to_paypal'] : '';
				$quantity_index  = isset( $new_tracking['quantity_index'] ) ? $new_tracking['quantity_index'] : '';
				if ( ! $quantity_index ) {
					$quantity_index = 1;
				} else {
					$quantity_index = intval( $quantity_index );
				}
				$result = array(
					'is_updated'    => false,
					'is_new'        => false,
					'email_sent'    => false,
					'sms_sent'      => false,
					'error'         => '',
					'item_id'       => $item_id,
					'item_name'     => '',
					'api_error'     => '',
					'tracking_data' => array(
						'tracking_number' => $tracking_number,
						'carrier_slug'    => $carrier_slug,
						'quantity_index'  => $quantity_index,
					),
				);
				if ( $item_id ) {
					$line_item = $order->get_item( $item_id );
					if ( $line_item ) {
						$quantity      = $line_item->get_quantity();
						$item_id_check = $item_id;
						if ( $quantity_index > 1 ) {
							if ($track_per_quantity && ( $quantity_index <= $quantity || $track_per_quantity ==='unlimited') ) {
								$item_id_check .= '_' . $quantity_index;
							}
						}
					}
				} else {
					$item_id_check = $order_id;
				}
				/*If tracking data of the same order item is passed multiple times in the same request, only the first one is used*/
				if ( isset( $item_id_check ) ) {
					if ( in_array( $item_id_check, $processed_items ) ) {
						$result['error'] = esc_html__( 'Duplicated tracking data', 'woocommerce-orders-tracking' );
						$results[]       = $result;
						continue;
					}
					$processed_items[] = $item_id_check;
				}
				/*Do not add to service/add to paypal via this function as we will do this in bulk later*/
				$result = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::set_tracking( $order_id, $tracking_number, $carrier_slug, $item_id, $quantity_index, false, false, false,
					$send_sms );
				if ( $result['is_updated'] ) {
					$updated_items_count ++;
				}
				if ( $tracking_number && ! $result['error'] ) {
					$carrier      = self::$settings->get_shipping_carrier_by_slug( $carrier_slug );
					$carrier_name = $carrier['name'];
					/*Add tracking numbers to a service carrier*/
					if ( $service_carrier_enable ) {
						switch ( $service_carrier_type ) {
							case 'trackingmore':
								$tracking_db_count              = VI_WOOCOMMERCE_ORDERS_TRACKING_TRACKINGMORE_TABLE::get_rows_by_tracking_number_carrier_pairs( array(
									array(
										'tracking_number' => $tracking_number,
										'carrier_slug'    => $carrier_slug
									)
								), true );
								$bulk_tracking_service_orders[] = array(
									'carrier_id'            => $carrier_slug,
									'tracking_more_slug'    => empty( $carrier['tracking_more_slug'] )
										? VI_WOOCOMMERCE_ORDERS_TRACKING_TRACKINGMORE::get_carrier_slug_by_name( $carrier_name ) : $carrier['tracking_more_slug'],
									'carrier_name'          => $carrier_name,
									'shipping_country_code' => $order->get_shipping_country(),
									'tracking_code'         => $tracking_number,
									'order_id'              => $order_id,
									'customer_phone'        => $order->get_billing_phone(),
									'customer_email'        => $order->get_billing_email(),
									'customer_name'         => $order->get_formatted_billing_full_name(),
								);
								break;
							case '17track':
							case 'tracktry':
								$tracking_db_count              = VI_WOOCOMMERCE_ORDERS_TRACKING_TRACK_INFO_TABLE::get_rows_by_tracking_number_carrier_pairs( array(
									array(
										'tracking_number' => $tracking_number,
										'carrier_slug'    => $carrier_slug
									)
								), $service_carrier_type, true );
								$bulk_tracking_service_orders[] = array(
									'carrier_name'    => $carrier_name,
									'tracking_number' => $tracking_number,
//									'order_id'        => $order_id,
								);
								break;
							default:
								$tracking_db_count = VI_WOOCOMMERCE_ORDERS_TRACKING_TRACK_INFO_TABLE::get_rows_by_tracking_number_carrier_pairs( array(
									array(
										'tracking_number' => $tracking_number,
										'carrier_slug'    => $carrier_slug
									)
								), $service_carrier_type, true );
								VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::add_tracking_to_service( $tracking_number, $carrier_slug, $carrier_name, $order_id, $api_error, $tracking_db_count );
								$result['api_error'] = $api_error;
						}
						if ( ! $tracking_db_count ) {
							if ( $service_carrier_type === 'trackingmore' ) {
								VI_WOOCOMMERCE_ORDERS_TRACKING_TRACKINGMORE_TABLE::insert( $order_id, $tracking_number, '', $carrier_slug, $carrier_name,
									VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_shipping_country_by_order_id( $order_id ), '', '', '' );
							} else {
								VI_WOOCOMMERCE_ORDERS_TRACKING_TRACK_INFO_TABLE::insert( $tracking_number, $order_id, $carrier_slug, $service_carrier_type, '', '', '', '', '' );
							}
						}
					}
					/*Mark tracking numbers that will be added to PayPal*/
					if ( $add_to_paypal ) {
						$paypal_orders[] = array(
							'carrier_name'    => $carrier_name,
							'tracking_number' => $tracking_number,
							'order_id'        => $order_id,
							'index'           => $i,
							//Remember the index to update status of each tracking number after adding to PayPal in batch
						);
					}
				}
				$results[] = $result;
			}
			if ( count( $bulk_tracking_service_orders ) ) {
				VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::bulk_add_tracking_to_service( $bulk_tracking_service_orders, $api_errors );
				if ( count( $api_errors ) ) {
					foreach ( $results as $key => $result ) {
						foreach ( $api_errors as $api_error ) {
							if ( $api_error['tracking_number'] && $api_error['tracking_number'] == $result['tracking_data']['tracking_number'] ) {
								$results[ $key ]['api_error'] = $api_error['api_error'];
								break;
							}
						}
					}
				}
			}
			/*Send email to customer if tracking data change*/
			$email_sent = false;
			if ( $send_email ) {
				$updated_trackings = array();
				foreach ( $results as $result ) {
					if ( $result['is_updated'] ) {
						$updated_trackings[] = array(
							'order_item_id'   => $result['item_id'],
							'order_item_name' => $result['item_name'],
							'tracking_number' => $result['tracking_data']['tracking_number'],
							'carrier_url'     => $result['tracking_data']['carrier_url'],
							'tracking_url'    => $result['tracking_data']['tracking_url'],
							'carrier_name'    => $result['tracking_data']['carrier_display_name'],
							'quantity_index'  => $result['tracking_data']['quantity_index'],
						);
					}
				}
				if ( count( $updated_trackings ) ) {
					$email_sent = VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_EMAIL::send_email( $order_id, $updated_trackings, true );
				}
			}

			/*Add tracking numbers to PayPal*/
			if ( $paypal_orders ) {
				$transaction_id = $order->get_transaction_id();
				$paypal_method  = $order->get_payment_method();
				if ( $transaction_id && in_array( $paypal_method, VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_PAYPAL::get_supported_paypal_gateways() ) ) {
					$send_paypal = array();
					foreach ( $paypal_orders as $paypal_order ) {
						$send_paypal[] = array(
							'trans_id'        => $transaction_id,
							'carrier_name'    => $paypal_order['carrier_name'],
							'tracking_number' => $paypal_order['tracking_number'],
							'order_id'        => $paypal_order['order_id'],
						);
					}

					$credentials = VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_PAYPAL::get_api_credentials( $paypal_method );
					if ( $credentials['id'] && $credentials['secret'] ) {
						$add_paypal = VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_PAYPAL::add_tracking_number( $credentials['id'], $credentials['secret'], $send_paypal,
							$credentials['sandbox'] );
						if ( $add_paypal['status'] === 'success' ) {
							$paypal_added_trackings = $order->get_meta( 'vi_wot_paypal_added_tracking_numbers', true );
							if ( ! $paypal_added_trackings ) {
								$paypal_added_trackings = array();
							}
							foreach ( $send_paypal as $send_paypal_item ) {
								if ( ! in_array( $send_paypal_item['tracking_number'], $paypal_added_trackings ) ) {
									$paypal_added_trackings[] = $send_paypal_item['tracking_number'];
								}
							}
							$order->update_meta_data( 'vi_wot_paypal_added_tracking_numbers', $paypal_added_trackings );
							$order->save_meta_data();
							for ( $i = 0; $i < count( $send_paypal ); $i ++ ) {
								$results[ $paypal_orders[ $i ]['index'] ]['add_to_paypal_result'] = array(
									'status'     => 'success',
									'error_code' => '',
									'message'    => ''
								);
							}
						} else {
							if ( isset( $add_paypal['errors'] ) && is_array( $add_paypal['errors'] ) && count( $add_paypal['errors'] ) ) {
								for ( $i = 0; $i < count( $send_paypal ); $i ++ ) {
									$send_paypal_item  = $send_paypal[ $i ];
									$error_description = $add_paypal['data'];
									$error_code        = '';
									foreach ( $add_paypal['errors'] as $error ) {
										if ( is_array( $error['details'] ) && count( $error['details'] ) ) {
											if ( ! empty( $error['details'][0]['value'] )
											     && ( $send_paypal_item['tracking_number'] == $error['details'][0]['value']
											          || $send_paypal_item['trans_id'] === $error['details'][0]['value'] )
											) {
												if ( ! empty( $error['details'][0]['issue'] ) ) {
													$error_code = $error['details'][0]['issue'];
												}
												if ( ! empty( $error['details'][0]['description'] ) ) {
													$error_description = $error['details'][0]['description'];
												}
												break;
											}
										}
									}
									$results[ $paypal_orders[ $i ]['index'] ]['add_to_paypal_result'] = array(
										'status'     => 'error',
										'error_code' => $error_code,
										'message'    => $error_description
									);
								}
							} else {
								for ( $i = 0; $i < count( $send_paypal ); $i ++ ) {
									$results[ $paypal_orders[ $i ]['index'] ]['add_to_paypal_result'] = array(
										'status'     => 'error',
										'error_code' => '',
										'message'    => $add_paypal['data']
									);
								}
							}
						}
					} else {
						for ( $i = 0; $i < count( $send_paypal ); $i ++ ) {
							$results[ $paypal_orders[ $i ]['index'] ]['add_to_paypal_result'] = array(
								'status'     => 'error',
								'error_code' => '',
								'message'    => esc_html__( 'PayPal payment method not supported or missing API credentials', 'woocommerce-orders-tracking' )
							);
						}
					}
				}
			}
			/*Change order status*/
			$order_status_changed = false;

			if ( $change_order_status ) {
				$set_status = $order->set_status( $change_order_status );
				if ( isset( $set_status['from'], $set_status['to'] ) && $set_status['to'] !== $set_status['from'] ) {
					$order_status_changed = true;
				}
				$order->save();
			}

			return rest_ensure_response( array(
				'results'              => $results,
				'updated_items_count'  => $updated_items_count,
				'email_sent'           => $email_sent,
				'order_status_changed' => $order_status_changed ? $change_order_status : '',
			) );
		}

		/**
		 * @param $request WP_REST_Request
		 *
		 * @return bool|WP_Error
		 */
		public function get_item_permissions_check( $request ) {
			$order = wc_get_order( (int) $request->get_param( 'order_id' ) );
			if ( $order && 0 !== $order->get_id() && ! wc_rest_check_post_permissions( 'shop_order', 'read', $order->get_id() ) ) {
				return new WP_Error( 'woocommerce_rest_cannot_view', esc_html__( 'Sorry, you cannot view this resource.', 'woocommerce-orders-tracking' ),
					array( 'status' => rest_authorization_required_code() ) );
			}

			return true;
		}

		/**
		 * @param $request WP_REST_Request
		 *
		 * @return bool|WP_Error
		 */
		public function edit_item_permissions_check( $request ) {
			$order = wc_get_order( (int) $request->get_param( 'order_id' ) );

			if ( $order && 0 !== $order->get_id() && ! wc_rest_check_post_permissions( 'shop_order', 'edit', $order->get_id() ) ) {
				return new WP_Error( 'woocommerce_rest_cannot_edit', esc_html__( 'Sorry, you cannot edit this resource.', 'woocommerce-orders-tracking' ),
					array( 'status' => rest_authorization_required_code() ) );
			}

			return true;
		}
	}
}