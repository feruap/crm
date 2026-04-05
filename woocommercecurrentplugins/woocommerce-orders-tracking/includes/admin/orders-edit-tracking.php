<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_ORDERS_EDIT_TRACKING {
	private static $settings;
	protected $carriers;

	public function __construct() {
		self::$settings = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_instance();
		$this->carriers = array();
		$this->enqueue_action();
	}

	public static function set( $name, $set_name = false ) {
		return VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::set( $name, $set_name );
	}

	public function enqueue_action() {
		add_action( 'admin_enqueue_scripts', array( $this, 'admin_enqueue_script' ), 9999 );
		add_filter( 'woocommerce_hidden_order_itemmeta', array( $this, 'woocommerce_hidden_order_itemmeta' ) );
		add_action( 'wp_ajax_wotv_save_track_info_item', array( $this, 'wotv_save_track_info_item' ) );
		add_action( 'wp_ajax_vi_woo_orders_tracking_add_tracking_to_paypal', array( $this, 'add_tracking_to_paypal' ) );
		add_action( 'add_meta_boxes', array( $this, 'order_details_add_meta_boxes' ) );
	}

	public function admin_enqueue_script() {
		$screen = get_current_screen();
		if ( in_array($screen->id ?? '',['shop_order','woocommerce_page_wc-orders']) ) {
			wp_enqueue_style( 'vi-wot-admin-edit-order-css', VI_WOOCOMMERCE_ORDERS_TRACKING_CSS . 'admin-edit-order.css', '', VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION );
			if ( ! wp_script_is( 'select2' ) ) {
				wp_enqueue_style( 'select2', VI_WOOCOMMERCE_ORDERS_TRACKING_CSS . 'select2.min.css', '', VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION );
				wp_enqueue_script( 'select2', VI_WOOCOMMERCE_ORDERS_TRACKING_JS . 'select2.js', array( 'jquery' ), VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION, false );
			}
			wp_enqueue_style( 'vi-wot-admin-order-manager-icon', VI_WOOCOMMERCE_ORDERS_TRACKING_CSS . 'woo-orders-tracking-icons.css', '',
				VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION );
			wp_enqueue_script( 'vi-wot-admin-edit-order-js', VI_WOOCOMMERCE_ORDERS_TRACKING_JS . 'admin-edit-order.js', array( 'jquery' ),
				VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION, false );
			wp_enqueue_script( 'vi-wot-admin-edit-carrier-functions-js', VI_WOOCOMMERCE_ORDERS_TRACKING_JS . 'carrier-functions.js', array( 'jquery' ),
				VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION, false );
			$shipping_carrier_default = self::$settings->get_params( 'shipping_carrier_default' );
			wp_localize_script( 'vi-wot-admin-edit-order-js',
				'vi_wot_edit_order',
				array(
					'ajax_url'                           => admin_url( 'admin-ajax.php' ),
					'shipping_carrier_default'           => $shipping_carrier_default,
					'shipping_carrier_default_url_check' => self::$settings->get_shipping_carrier_url( $shipping_carrier_default, 'custom-carrier' ),
					'active_carriers'                    => self::$settings->get_params( 'active_carriers' ),
					'custom_carriers_list'               => self::$settings->get_params( 'custom_carriers_list' ),
					'shipping_carriers_define_list'      => self::$settings->get_params( 'shipping_carriers_define_list' ),
					'edit_single_tracking_old_ui'        => self::$settings->get_params( 'edit_single_tracking_old_ui' ),
					'error_empty_field'                  => esc_html__( 'Please fill full information for tracking', 'woocommerce-orders-tracking' ),
					'paypal_image'                       => VI_WOOCOMMERCE_ORDERS_TRACKING_PAYPAL_IMAGE,
					'loading_image'                      => VI_WOOCOMMERCE_ORDERS_TRACKING_LOADING_IMAGE,
					'i18n_tracking_number_field_title'   => esc_attr__( 'Tracking carrier %s', 'woocommerce-orders-tracking' ),// phpcs:ignore WordPress.WP.I18n.MissingTranslatorsComment
				)
			);
			add_action( 'admin_footer-post.php', array( $this, 'orders_tracking_edit_tracking_footer' ) );
			VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_ORDERS_TRACK_INFO::enqueue_main_script();
			add_action( 'woocommerce_after_order_itemmeta', array(
				$this,
				'woocommerce_after_order_itemmeta'
			), 10, 3 );
		}
	}

	/**
	 * @throws Exception
	 */
	public function add_tracking_to_paypal() {
		$action_nonce = isset( $_POST['action_nonce'] ) ? wp_unslash( sanitize_text_field( $_POST['action_nonce'] ) ) : '';
		if ( ! wp_verify_nonce( $action_nonce, 'vi_wot_item_action_nonce' ) ) {
			return;
		}
		$order_id = isset( $_POST['order_id'] ) ? sanitize_text_field( $_POST['order_id'] ) : '';
		if ( ! current_user_can( 'edit_post', $order_id ) ) {
			wp_die( esc_html__( 'Sorry, you are not allowed to edit this order.', 'woocommerce-orders-tracking' ) );
		}
		$response = array(
			'status'                 => 'error',
			'message'                => esc_html__( 'Cannot add tracking to PayPal', 'woocommerce-orders-tracking' ),
			'message_content'        => '',
			'paypal_added_trackings' => '',
			'paypal_button_title'    => '',
		);
		$item_id  = isset( $_POST['item_id'] ) ? sanitize_text_field( $_POST['item_id'] ) : '';
		if ( $order_id ) {
			$order = wc_get_order( $order_id );
			if ( $order ) {
				$transID       = $order->get_transaction_id();
				$paypal_method = $order->get_payment_method();
				if ( $transID && $paypal_method ) {
					$tracking_number = $carrier_slug = $carrier_name = '';
					if ( $item_id ) {
						$item_tracking_data = wc_get_order_item_meta( $item_id, '_vi_wot_order_item_tracking_data', true );
						if ( $item_tracking_data ) {
							$item_tracking_data    = vi_wot_json_decode( $item_tracking_data );
							$current_tracking_data = array_pop( $item_tracking_data );
							$tracking_number       = $current_tracking_data['tracking_number'];
							$carrier_slug          = $current_tracking_data['carrier_slug'];
						}
					} else {
						$tracking_number = $order->get_meta( '_wot_tracking_number', true );
						$carrier_slug    = $order->get_meta( '_wot_tracking_carrier', true );
					}
					if ( $tracking_number && $carrier_slug ) {
						$carrier = self::$settings->get_shipping_carrier_by_slug( $carrier_slug );
						if ( is_array( $carrier ) && count( $carrier ) ) {
							$carrier_name           = $carrier['name'];
							$paypal_added_trackings = $order->get_meta( 'vi_wot_paypal_added_tracking_numbers', true );
							if ( ! $paypal_added_trackings ) {
								$paypal_added_trackings = array();
							}
							$response['message_content'] = '<div>' . sprintf( esc_html__( 'Tracking number: %s', 'woocommerce-orders-tracking' ), $tracking_number ) . '</div>';// phpcs:ignore WordPress.WP.I18n.MissingTranslatorsComment
							if ( ! in_array( $tracking_number, $paypal_added_trackings ) ) {
								$result_add_paypal = $this->add_trackinfo_to_paypal( array(
									array(
										'trans_id'        => $transID,
										'carrier_name'    => $carrier_name,
										'tracking_number' => $tracking_number,
									)
								), $paypal_method );
								if ( $result_add_paypal['status'] === 'error' ) {
									$response['message'] = empty( $result_add_paypal['data'] ) ? esc_html__( 'Cannot add tracking to PayPal', 'woocommerce-orders-tracking' )
										: $result_add_paypal['data'];
								} else {
									$response['status']       = 'success';
									$response['message']      = esc_html__( 'Add Tracking to PayPal successfully', 'woocommerce-orders-tracking' );
									$paypal_added_trackings[] = $tracking_number;
									$order->update_meta_data( 'vi_wot_paypal_added_tracking_numbers', $paypal_added_trackings );
									$order->save_meta_data();
									$response['paypal_added_trackings'] = implode( ',', array_filter( $paypal_added_trackings ) );
									$response['paypal_button_title']    = esc_html__( 'This tracking number was added to PayPal', 'woocommerce-orders-tracking' );
								}
							} else {
								$response['status']              = 'success';
								$response['message']             = esc_html__( 'Add Tracking to PayPal successfully', 'woocommerce-orders-tracking' );
								$response['paypal_button_title'] = esc_html__( 'This tracking number was added to PayPal', 'woocommerce-orders-tracking' );
							}
						} else {
							$response['message'] = esc_html__( 'Invalid carrier', 'woocommerce-orders-tracking' );
						}
					} else {
						$response['message'] = esc_html__( 'Missing tracking data', 'woocommerce-orders-tracking' );
					}
				} else {
					$response['message'] = esc_html__( 'Missing transaction ID or payment method', 'woocommerce-orders-tracking' );
				}
			}
		}

		wp_send_json( $response );
	}

	/**
	 * @throws Exception
	 */
	public function wotv_save_track_info_item() {
		$action_nonce = isset( $_POST['action_nonce'] ) ? wp_unslash( sanitize_text_field( $_POST['action_nonce'] ) ) : '';
		if ( ! wp_verify_nonce( $action_nonce, 'vi_wot_item_action_nonce' ) ) {
			return;
		}
		$order_id = isset( $_POST['order_id'] ) ? sanitize_text_field( $_POST['order_id'] ) : '';
		if ( ! current_user_can( 'edit_post', $order_id ) ) {
			wp_die( esc_html__( 'Sorry, you are not allowed to edit this order.', 'woocommerce-orders-tracking' ) );
		}
		$quantity_index           = isset( $_POST['quantity_index'] ) ? intval( $_POST['quantity_index'] ) : 1;
		$item_id                  = isset( $_POST['item_id'] ) ? sanitize_text_field( $_POST['item_id'] ) : '';
		$item_name                = isset( $_POST['item_name'] ) ? sanitize_text_field( $_POST['item_name'] ) : '';
		$change_order_status      = isset( $_POST['change_order_status'] ) ? sanitize_text_field( $_POST['change_order_status'] ) : '';
		$send_mail                = isset( $_POST['send_mail'] ) ? sanitize_text_field( $_POST['send_mail'] ) : '';
		$send_sms                 = isset( $_POST['send_sms'] ) ? sanitize_text_field( $_POST['send_sms'] ) : '';
		$add_to_paypal            = isset( $_POST['add_to_paypal'] ) ? sanitize_text_field( $_POST['add_to_paypal'] ) : '';
		$tracking_number          = isset( $_POST['tracking_number'] ) ? sanitize_text_field( $_POST['tracking_number'] ) : '';
		$carrier_slug             = isset( $_POST['carrier_id'] ) ? sanitize_text_field( $_POST['carrier_id'] ) : '';
		$carrier_name             = isset( $_POST['carrier_name'] ) ? sanitize_text_field( $_POST['carrier_name'] ) : '';
		$display_name             = $carrier_name;
		$add_new_carrier          = isset( $_POST['add_new_carrier'] ) ? sanitize_text_field( $_POST['add_new_carrier'] ) : '';
		$carrier_type             = '';
		$order                    = wc_get_order( $order_id );
		$transID                  = $order->get_transaction_id();
		$paypal_method            = $order->get_payment_method();
		$settings                 = self::$settings->get_params();
		$settings['order_status'] = $change_order_status;
		$response                 = array(
			'status'                   => 'success',
			'paypal_status'            => 'success',
			'paypal_message'           => '',
			'message'                  => esc_html__( 'Tracking saved', 'woocommerce-orders-tracking' ),
			'detail'                   => '',
			'tracking_number'          => $tracking_number,
			'tracking_url'             => '',
			'tracking_url_show'        => '',
			'carrier_name'             => $carrier_name,
			'carrier_id'               => $carrier_slug,
			'carrier_type'             => $carrier_type,
			'item_id'                  => $item_id,
			'change_order_status'      => $change_order_status,
			'paypal_button_class'      => '',
			'paypal_button_title'      => '',
			'paypal_added_trackings'   => '',
			'tracking_service'         => '',
			'tracking_service_status'  => 'success',
			'tracking_service_message' => '',
			'digital_delivery'         => 0,
			'sms_status'               => '',
			'sms_message'              => '',
			'sms_message_title'        => '',
		);
		$settings['email_enable'] = $send_mail === 'yes' ? 1 : 0;
		$settings['sms_enable']   = $send_sms === 'yes' ? 1 : 0;
		$tracking_more_slug       = '';
		$digital_delivery         = 0;
		if ( $add_new_carrier ) {
			$tracking_url     = isset( $_POST['tracking_url'] ) ? sanitize_text_field( $_POST['tracking_url'] ) : '';
			$shipping_country = isset( $_POST['shipping_country'] ) ? sanitize_text_field( $_POST['shipping_country'] ) : '';
			$carrier_url      = $tracking_url;
			if ( $carrier_name && $tracking_url && $shipping_country ) {
				$custom_carriers_list = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_custom_carriers();
				$custom_carrier       = array(
					'name'         => $carrier_name,
					'display_name' => $display_name,
					'slug'         => VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::generate_custom_carrier_slug( $carrier_name ),
					'url'          => $tracking_url,
					'country'      => $shipping_country,
					'type'         => 'custom',
				);
				$carrier_slug         = $custom_carrier['slug'];

				$custom_carriers_list[]           = $custom_carrier;
				$settings['custom_carriers_list'] = vi_wot_json_encode( $custom_carriers_list );
				$carrier_type                     = 'custom-carrier';
				$tracking_more_slug               = VI_WOOCOMMERCE_ORDERS_TRACKING_TRACKINGMORE::get_carrier_slug_by_name( $carrier_name );
			} else {
				$response['status']  = 'error';
				$response['message'] = esc_html__( 'Not enough information', 'woocommerce-orders-tracking' );
				wp_send_json( $response );
			}
		} else {
			$carrier = self::$settings->get_shipping_carrier_by_slug( $carrier_slug );
			if ( is_array( $carrier ) && count( $carrier ) ) {
				$carrier_url  = $carrier['url'];
				$carrier_name = $carrier['name'];
				if ( ! empty( $carrier['display_name'] ) ) {
					$display_name = $carrier['display_name'];
				} else {
					$display_name = $carrier_name;
				}
				$carrier_type       = $carrier['carrier_type'];
				$tracking_more_slug = empty( $carrier['tracking_more_slug'] ) ? VI_WOOCOMMERCE_ORDERS_TRACKING_TRACKINGMORE::get_carrier_slug_by_name( $carrier_name )
					: $carrier['tracking_more_slug'];
				if ( isset( $carrier['digital_delivery'] ) ) {
					$digital_delivery             = $carrier['digital_delivery'];
					$response['digital_delivery'] = $digital_delivery;
					if ( $digital_delivery == 1 ) {
						$tracking_number = '';
					}
				}
			} else {
				$carrier_url = '';
			}
		}

		update_option( 'woo_orders_tracking_settings', $settings );

		if ( ! $order_id || ! $item_id || ( ! $tracking_number && $digital_delivery != 1 ) || ! $carrier_slug || ! $carrier_type ) {
			$response['status'] = 'error';
			wp_send_json(
				$response
			);
		}
		$now              = time();
		$tracking_change  = true;
		$add_new_tracking = false;
		if ( !self::$settings->get_params('track_per_quantity')) {
			$item_tracking_data    = wc_get_order_item_meta( $item_id, '_vi_wot_order_item_tracking_data', true );
			$current_tracking_data = array(
				'tracking_number' => '',
				'carrier_slug'    => '',
				'carrier_url'     => '',
				'carrier_name'    => '',
				'carrier_type'    => '',
				'time'            => $now,
			);
			if ( $item_tracking_data ) {
				$item_tracking_data = vi_wot_json_decode( $item_tracking_data );
				if ( $digital_delivery == 1 ) {
					$current_tracking_data = array_pop( $item_tracking_data );
					if ( ! empty( $current_tracking_data['tracking_number'] ) || empty( $current_tracking_data['carrier_slug'] ) || empty( $current_tracking_data['carrier_name'] )
					     || empty( $current_tracking_data['carrier_url'] )
					) {
						$item_tracking_data[] = $current_tracking_data;
					} else {
						$current_tracking_data['status']      = '';
						$current_tracking_data['last_update'] = '';
						if ( $current_tracking_data['carrier_url'] == $carrier_url ) {
							$tracking_change = false;
						}
					}
				} else {
					foreach ( $item_tracking_data as $order_tracking_data_k => $order_tracking_data_v ) {
						if ( $order_tracking_data_v['tracking_number'] == $tracking_number ) {
							$current_tracking_data = $order_tracking_data_v;
							if ( $current_tracking_data['carrier_url'] == $carrier_url && $order_tracking_data_k === ( count( $item_tracking_data ) - 1 ) ) {
								$tracking_change = false;
							}
							unset( $item_tracking_data[ $order_tracking_data_k ] );
							break;
						}
					}
				}
				$item_tracking_data = array_values( $item_tracking_data );
			} else {
				$item_tracking_data = array();
				$add_new_tracking   = true;
			}
		} else {
			$tracking_change = apply_filters( 'vi_woo_orders_tracking_single_edit_is_tracking_change', false, $quantity_index, $tracking_number, $carrier_slug, $item_id,
				$order_id );
		}

		$current_tracking_data['tracking_number'] = $tracking_number;
		$current_tracking_data['carrier_slug']    = $carrier_slug;
		$current_tracking_data['carrier_url']     = $carrier_url;
		$current_tracking_data['carrier_name']    = $carrier_name;
		$current_tracking_data['carrier_type']    = $carrier_type;

		do_action( 'vi_woo_orders_tracking_single_edit_tracking_change', $tracking_change, $current_tracking_data, $item_id, $order_id, $response );

		$response['carrier_id']   = $carrier_slug;
		$response['carrier_type'] = $carrier_type;
		$response['carrier_url']  = $carrier_url;

		$paypal_added_trackings = $order->get_meta( 'vi_wot_paypal_added_tracking_numbers', true );
		if ( ! $paypal_added_trackings ) {
			$paypal_added_trackings = array();
		}
		if ( $add_to_paypal === 'yes' && $transID && $paypal_method && ! in_array( $tracking_number, $paypal_added_trackings ) ) {
			$send_paypal       = array(
				array(
					'trans_id'        => $transID,
					'carrier_name'    => $carrier_name,
//					'carrier_name'    => $display_name,
					'tracking_number' => $tracking_number,
				)
			);
			$result_add_paypal = $this->add_trackinfo_to_paypal( $send_paypal, $paypal_method );
			if ( $result_add_paypal['status'] === 'error' ) {
				$response['paypal_status']  = 'error';
				$response['paypal_message'] = empty( $result_add_paypal['data'] ) ? esc_html__( 'Cannot add tracking to PayPal', 'woocommerce-orders-tracking' )
					: $result_add_paypal['data'];
			} else {
				$paypal_added_trackings[] = $tracking_number;
				$order->update_meta_data( 'vi_wot_paypal_added_tracking_numbers', $paypal_added_trackings );
				$order->save_meta_data();
			}
		}
		$response['paypal_added_trackings'] = implode( ', ', array_filter( $paypal_added_trackings ) );
		if ( ! in_array( $tracking_number, $paypal_added_trackings ) ) {
			$response['paypal_button_class'] = 'active';
			$response['paypal_button_title'] = esc_html__( 'Add this tracking number to PayPal', 'woocommerce-orders-tracking' );
		} else {
			$response['paypal_button_class'] = 'inactive';
			$response['paypal_button_title'] = esc_html__( 'This tracking number was added to PayPal', 'woocommerce-orders-tracking' );
		}
		$tracking_url_import = self::$settings->get_url_tracking( $carrier_url, $tracking_number, $carrier_slug, $order->get_shipping_postcode(), false, true, $order_id );
		if ( self::$settings->get_params( 'service_carrier_enable' ) && $tracking_number ) {
			$service_carrier_type         = self::$settings->get_params( 'service_carrier_type' );
			$response['tracking_service'] = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::service_carriers_list( $service_carrier_type );
			switch ( $service_carrier_type ) {
				case 'trackingmore':
					$tracking_from_db        = VI_WOOCOMMERCE_ORDERS_TRACKING_TRACKINGMORE_TABLE::get_row_by_tracking_number( $tracking_number, $carrier_slug, $order_id );
					$service_carrier_api_key = self::$settings->get_params( 'service_carrier_api_key' );
					$trackingMore            = new VI_WOOCOMMERCE_ORDERS_TRACKING_TRACKINGMORE( $service_carrier_api_key );
					$description             = '';
					$status                  = '';
					$track_info              = '';
					if ( ! count( $tracking_from_db ) ) {
						$track_data = $trackingMore->create_tracking( $tracking_number, $tracking_more_slug, $order_id );
						if ( $track_data['status'] === 'success' ) {
							$status = $track_data['data']['status'];
							VI_WOOCOMMERCE_ORDERS_TRACKING_TRACKINGMORE_TABLE::insert( $order_id, $tracking_number, $status, $carrier_slug, $carrier_name,
								VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_shipping_country_by_order_id( $order_id ), $track_info, '', '' );
						} else {
							if ( $track_data['code'] === 4016 ) {
								/*Tracking exists*/
								$track_data = $trackingMore->get_tracking( $tracking_number, $tracking_more_slug );
								if ( $track_data['status'] === 'success' ) {
									if ( count( $track_data['data'] ) ) {
										$track_info                           = vi_wot_json_encode( $track_data['data'] );
										$last_event                           = array_shift( $track_data['data'] );
										$status                               = $last_event['status'];
										$description                          = $last_event['description'];
										$current_tracking_data['status']      = $last_event['status'];
										$current_tracking_data['last_update'] = $now;
									}
									VI_WOOCOMMERCE_ORDERS_TRACKING_TRACKINGMORE_TABLE::insert( $order_id, $tracking_number, $status, $carrier_slug, $carrier_name,
										VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_shipping_country_by_order_id( $order_id ), $track_info, $description );
								} else {
									VI_WOOCOMMERCE_ORDERS_TRACKING_TRACKINGMORE_TABLE::insert( $order_id, $tracking_number, $status, $carrier_slug, $carrier_name,
										VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_shipping_country_by_order_id( $order_id ), $track_info, $description, '' );
									$response['tracking_service_status']  = 'error';
									$response['tracking_service_message'] = $track_data['data'];
								}
							} else {
								VI_WOOCOMMERCE_ORDERS_TRACKING_TRACKINGMORE_TABLE::insert( $order_id, $tracking_number, $status, $carrier_slug, $carrier_name,
									VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_shipping_country_by_order_id( $order_id ), $track_info, $description, '' );
								$response['tracking_service_status']  = 'error';
								$response['tracking_service_message'] = $track_data['data'];
							}
						}
					} else {
						$need_update_tracking_table = true;
						$convert_status             = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::convert_status( $tracking_from_db['status'] );
						if ( $convert_status !== 'delivered' ) {
							$track_data = $trackingMore->get_tracking( $tracking_number, $tracking_more_slug );
							if ( $track_data['status'] === 'success' ) {
								if ( count( $track_data['data'] ) ) {
									$need_update_tracking_table           = false;
									$track_info                           = vi_wot_json_encode( $track_data['data'] );
									$last_event                           = array_shift( $track_data['data'] );
									$status                               = $last_event['status'];
									$description                          = $last_event['description'];
									$current_tracking_data['status']      = $last_event['status'];
									$current_tracking_data['last_update'] = $now;
									VI_WOOCOMMERCE_ORDERS_TRACKING_TRACKINGMORE_TABLE::update( $tracking_from_db['id'], $order_id, $status, $carrier_slug, $carrier_name,
										VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_shipping_country_by_order_id( $order_id ), $track_info, $description );
									if ( $last_event['status'] !== $tracking_from_db['status'] || $track_info !== $tracking_from_db['track_info'] ) {
										$response['tracking_change'] = 1;
									}
								}
							} else {
								if ( $track_data['code'] === 4017 || $track_data['code'] === 4031 ) {
									/*Tracking NOT exists*/
									$track_data = $trackingMore->create_tracking( $tracking_number, $tracking_more_slug, $order_id );
									if ( $track_data['status'] === 'success' ) {
										$status                               = $track_data['data']['status'];
										$current_tracking_data['status']      = $status;
										$current_tracking_data['last_update'] = $now;
										VI_WOOCOMMERCE_ORDERS_TRACKING_TRACKINGMORE_TABLE::update( $tracking_from_db['id'], $order_id, $status, $carrier_slug, $carrier_name,
											VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_shipping_country_by_order_id( $order_id ), $track_info, $description );
									}
								} else {
									$response['tracking_service_status']  = 'error';
									$response['tracking_service_message'] = $track_data['data'];
								}
							}
						} else {
							$status                               = $tracking_from_db['status'];
							$current_tracking_data['status']      = $status;
							$current_tracking_data['last_update'] = $now;
						}

						if ( $need_update_tracking_table && $order_id != $tracking_from_db['order_id'] ) {
							VI_WOOCOMMERCE_ORDERS_TRACKING_TRACKINGMORE_TABLE::update( $tracking_from_db['id'], $order_id, $status, $carrier_slug, $carrier_name,
								VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_shipping_country_by_order_id( $order_id ), $track_info, $description );
						}
					}
					break;
				case 'aftership':
					$tracking_from_db        = VI_WOOCOMMERCE_ORDERS_TRACKING_TRACK_INFO_TABLE::get_row_by_tracking_number( $tracking_number, $carrier_slug, $service_carrier_type,
						$order_id );
					$service_carrier_api_key = self::$settings->get_params( 'service_carrier_api_key' );
					$find_carrier            = VI_WOOCOMMERCE_ORDERS_TRACKING_AFTERSHIP::get_carrier_slug_by_name( $carrier_name );
					$aftership               = new VI_WOOCOMMERCE_ORDERS_TRACKING_AFTERSHIP( $service_carrier_api_key );
					$status                  = '';
					$description             = '';
					$track_info              = '';
					if ( ! count( $tracking_from_db ) ) {
						$track_data = $aftership->create( $tracking_number, $find_carrier, $order_id );
						if ( $track_data['status'] === 'success' ) {
							$status = $track_data['data']['tag'];
							VI_WOOCOMMERCE_ORDERS_TRACKING_TRACK_INFO_TABLE::insert( $tracking_number, $order_id, $carrier_slug, $service_carrier_type, $status, '', '',
								$track_data['est_delivery_date'], '' );
						} else {
							if ( $track_data['code'] === 4003 ) {
								/*Tracking exists*/
								$mobile      = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::format_phone_number( $order->get_billing_phone(), $order->get_shipping_country() );
								$update_args = array(
									'order_id'      => $order_id,
									'emails'        => array( $order->get_billing_email() ),
									'customer_name' => $order->get_billing_first_name(),
								);
								if ( $mobile ) {
									$update_args['smses'] = array( $mobile );
								}
								$track_data = $aftership->update( $tracking_number, $find_carrier, $update_args );
								if ( $track_data['status'] === 'success' ) {
									if ( count( $track_data['data'] ) ) {
										$track_info                           = vi_wot_json_encode( $track_data['data'] );
										$last_event                           = array_shift( $track_data['data'] );
										$status                               = $last_event['status'];
										$description                          = $last_event['description'];
										$current_tracking_data['status']      = $last_event['status'];
										$current_tracking_data['last_update'] = $now;
									}
								} else {
									$response['tracking_service_status']  = 'error';
									$response['tracking_service_message'] = $track_data['data'];
								}
							} else {
								$response['tracking_service_status']  = 'error';
								$response['tracking_service_message'] = $track_data['data'];
							}
							VI_WOOCOMMERCE_ORDERS_TRACKING_TRACK_INFO_TABLE::insert( $tracking_number, $order_id, $carrier_slug, $service_carrier_type, $status, $track_info,
								$description, '', '' );
						}
					} else {
						$need_update_tracking_table = true;
						if ( VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::convert_status( $tracking_from_db['status'] ) !== 'delivered' ) {
							$update_args = array(
								'order_id'      => $order_id,
								'emails'        => array( $order->get_billing_email() ),
								'customer_name' => $order->get_billing_first_name(),
							);
							$mobile      = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::format_phone_number( $order->get_billing_phone(), $order->get_shipping_country() );
							if ( $mobile ) {
								$update_args['smses'] = array( $mobile );
							}
							$track_data = $aftership->update( $tracking_number, $find_carrier, $update_args );
							if ( $track_data['status'] === 'success' ) {
								if ( count( $track_data['data'] ) ) {
									$need_update_tracking_table           = false;
									$track_info                           = vi_wot_json_encode( $track_data['data'] );
									$last_event                           = array_shift( $track_data['data'] );
									$status                               = $last_event['status'];
									$current_tracking_data['status']      = $last_event['status'];
									$current_tracking_data['last_update'] = $now;
									VI_WOOCOMMERCE_ORDERS_TRACKING_TRACK_INFO_TABLE::update( $tracking_from_db['id'], $order_id, $carrier_slug, $service_carrier_type, $status,
										$track_info, $last_event['description'], $track_data['est_delivery_date'] );
									if ( $last_event['status'] !== $tracking_from_db['status'] || $track_info !== $tracking_from_db['track_info'] ) {
										$response['tracking_change'] = 1;
									}
								}
							} else {
								if ( $track_data['code'] === 4004 ) {
									/*Tracking NOT exists*/
									$track_data = $aftership->create( $tracking_number, $find_carrier, $order_id );
									if ( $track_data['status'] !== 'success' ) {
										$response['tracking_service_status']  = 'error';
										$response['tracking_service_message'] = $track_data['data'];
									}
								} else {
									$response['tracking_service_status']  = 'error';
									$response['tracking_service_message'] = $track_data['data'];
								}
							}
						} else {
							$current_tracking_data['status']      = $tracking_from_db['status'];
							$current_tracking_data['last_update'] = $tracking_from_db['modified_at'];
						}

						if ( $need_update_tracking_table && $order_id != $tracking_from_db['order_id'] || $service_carrier_type !== $tracking_from_db['carrier_service'] ) {
							VI_WOOCOMMERCE_ORDERS_TRACKING_TRACK_INFO_TABLE::update( $tracking_from_db['id'], $order_id, $carrier_slug, $service_carrier_type );
						}
					}
					break;
				case '17track':
					$tracking_from_db        = VI_WOOCOMMERCE_ORDERS_TRACKING_TRACK_INFO_TABLE::get_row_by_tracking_number( $tracking_number, $carrier_slug, $service_carrier_type,
						$order_id );
					$service_carrier_api_key = self::$settings->get_params( 'service_carrier_api_key' );
					$_17track                = new VI_WOOCOMMERCE_ORDERS_TRACKING_17TRACK( $service_carrier_api_key );
					$status                  = '';

					if ( ! count( $tracking_from_db ) ) {
						$track_data = $_17track->create( array(
							array(
								'tracking_number' => $tracking_number,
								'carrier_name'    => $carrier_name
							)
						) );
						VI_WOOCOMMERCE_ORDERS_TRACKING_TRACK_INFO_TABLE::insert( $tracking_number, $order_id, $carrier_slug, $service_carrier_type, $status, '', '',
							$track_data['est_delivery_date'], '' );
						if ( $track_data['status'] === 'error' ) {
							$response['tracking_service_status']  = 'error';
							$response['tracking_service_message'] = $track_data['data'];
						}
					} else {
						$need_update_tracking_table = true;
						if ( VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::convert_status( $tracking_from_db['status'] ) !== 'delivered' ) {
							$track_data = $_17track->get_tracking_data( $tracking_number, $carrier_name );
							if ( $track_data['status'] === 'success' ) {
								if ( count( $track_data['data'] ) ) {
									$need_update_tracking_table           = false;
									$track_info                           = vi_wot_json_encode( $track_data['data'] );
									$last_event                           = array_shift( $track_data['data'] );
									$status                               = $last_event['status'];
									$current_tracking_data['status']      = $last_event['status'];
									$current_tracking_data['last_update'] = $now;
									VI_WOOCOMMERCE_ORDERS_TRACKING_TRACK_INFO_TABLE::update( $tracking_from_db['id'], $order_id, $carrier_slug, $service_carrier_type, $status,
										$track_info, $last_event['description'], $track_data['est_delivery_date'] );
									if ( $last_event['status'] !== $tracking_from_db['status'] || $track_info !== $tracking_from_db['track_info'] ) {
										$response['tracking_change'] = 1;
									}
								}
							} else {
								if ( $track_data['code'] == - 18019902 ) {
									/*Tracking NOT exists*/
									$track_data = $_17track->create( array(
										array(
											'tracking_number' => $tracking_number,
											'carrier_name'    => $carrier_name
										)
									) );
									if ( $track_data['status'] !== 'success' ) {
										$response['tracking_service_status']  = 'error';
										$response['tracking_service_message'] = $track_data['data'];
									}
								} elseif ( $track_data['code'] == - 18019910 ) {
									/*Tracking carrier not correct*/
									if ( $carrier_name !== $track_data['carrier_name'] ) {
										$_17track->change_carrier( array(
											array(
												'tracking_number' => $tracking_number,
												'carrier_name'    => $carrier_name
											)
										) );
									}
								} else {
									$response['tracking_service_status']  = 'error';
									$response['tracking_service_message'] = $track_data['data'];
								}
							}
						} else {
							$current_tracking_data['status']      = $tracking_from_db['status'];
							$current_tracking_data['last_update'] = $tracking_from_db['modified_at'];
						}

						if ( $need_update_tracking_table && $order_id != $tracking_from_db['order_id'] || $service_carrier_type !== $tracking_from_db['carrier_service'] ) {
							VI_WOOCOMMERCE_ORDERS_TRACKING_TRACK_INFO_TABLE::update( $tracking_from_db['id'], $order_id, $carrier_slug, $service_carrier_type );
						}
					}
					break;
				case 'tracktry':
					$tracking_from_db        = VI_WOOCOMMERCE_ORDERS_TRACKING_TRACK_INFO_TABLE::get_row_by_tracking_number( $tracking_number, $carrier_slug, $service_carrier_type,
						$order_id );
					$service_carrier_api_key = self::$settings->get_params( 'service_carrier_api_key' );
					$tracktry                = new VI_WOOCOMMERCE_ORDERS_TRACKING_TRACKTRY( $service_carrier_api_key );
					$status                  = '';

					if ( ! count( $tracking_from_db ) ) {
						$track_data = $tracktry->create( array(
							array(
								'tracking_number' => $tracking_number,
								'carrier_name'    => $carrier_name
							)
						) );
						VI_WOOCOMMERCE_ORDERS_TRACKING_TRACK_INFO_TABLE::insert( $tracking_number, $order_id, $carrier_slug, $service_carrier_type, $status, '', '',
							$track_data['est_delivery_date'], '' );
						if ( $track_data['status'] === 'error' ) {
							$response['tracking_service_status']  = 'error';
							$response['tracking_service_message'] = $track_data['data'];
						}
					} else {
						$need_update_tracking_table = true;
						if ( VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::convert_status( $tracking_from_db['status'] ) !== 'delivered' ) {
							$track_data = $tracktry->get_tracking_data( $tracking_number, $carrier_name );
							if ( $track_data['status'] === 'success' ) {
								if ( count( $track_data['data'] ) ) {
									$need_update_tracking_table           = false;
									$track_info                           = vi_wot_json_encode( $track_data['data'] );
									$last_event                           = array_shift( $track_data['data'] );
									$status                               = $last_event['status'];
									$current_tracking_data['status']      = $last_event['status'];
									$current_tracking_data['last_update'] = $now;
									VI_WOOCOMMERCE_ORDERS_TRACKING_TRACK_INFO_TABLE::update( $tracking_from_db['id'], $order_id, $carrier_slug, $service_carrier_type, $status,
										$track_info, $last_event['description'], $track_data['est_delivery_date'] );
									if ( $last_event['status'] !== $tracking_from_db['status'] || $track_info !== $tracking_from_db['track_info'] ) {
										$response['tracking_change'] = 1;
									}
								}
							} else {
								if ( $track_data['code'] == 4017 ) {
									/*Tracking NOT exists*/
									$track_data = $tracktry->create( array(
										array(
											'tracking_number' => $tracking_number,
											'carrier_name'    => $carrier_name
										)
									) );
									if ( $track_data['status'] !== 'success' ) {
										$response['tracking_service_status']  = 'error';
										$response['tracking_service_message'] = $track_data['data'];
									}
								} elseif ( $track_data['code'] == 4032 ) {
									/*Tracking carrier not correct*/
									if ( $carrier_name !== $track_data['carrier_name'] ) {

									}
								} else {
									$response['tracking_service_status']  = 'error';
									$response['tracking_service_message'] = $track_data['data'];
								}
							}
						} else {
							$current_tracking_data['status']      = $tracking_from_db['status'];
							$current_tracking_data['last_update'] = $tracking_from_db['modified_at'];
						}

						if ( $need_update_tracking_table && $order_id != $tracking_from_db['order_id'] || $service_carrier_type !== $tracking_from_db['carrier_service'] ) {
							VI_WOOCOMMERCE_ORDERS_TRACKING_TRACK_INFO_TABLE::update( $tracking_from_db['id'], $order_id, $carrier_slug, $service_carrier_type );
						}
					}
					break;
				case 'easypost':
					$tracking_from_db        = VI_WOOCOMMERCE_ORDERS_TRACKING_TRACK_INFO_TABLE::get_row_by_tracking_number( $tracking_number, $carrier_slug, $service_carrier_type,
						$order_id );
					$service_carrier_api_key = self::$settings->get_params( 'service_carrier_api_key' );
					$find_carrier            = VI_WOOCOMMERCE_ORDERS_TRACKING_EASYPOST::get_carrier_slug_by_name( $carrier_name );
					$easyPost                = new VI_WOOCOMMERCE_ORDERS_TRACKING_EASYPOST( $service_carrier_api_key );
					if ( ! count( $tracking_from_db ) ) {
						$track_data = $easyPost->create( $tracking_number, $find_carrier );
						if ( $track_data['status'] === 'success' ) {
							if ( count( $track_data['data'] ) ) {
								$track_info                           = vi_wot_json_encode( $track_data['data'] );
								$last_event                           = array_shift( $track_data['data'] );
								$status                               = $last_event['status'];
								$current_tracking_data['status']      = $last_event['status'];
								$current_tracking_data['last_update'] = $now;
								VI_WOOCOMMERCE_ORDERS_TRACKING_TRACK_INFO_TABLE::insert( $tracking_number, $order_id, $carrier_slug, $service_carrier_type, $status, $track_info,
									$last_event['description'], $track_data['est_delivery_date'] );
							} else {
								VI_WOOCOMMERCE_ORDERS_TRACKING_TRACK_INFO_TABLE::insert( $tracking_number, $order_id, $carrier_slug, $service_carrier_type, '', '', '',
									$track_data['est_delivery_date'], '' );
							}
						} else {
							VI_WOOCOMMERCE_ORDERS_TRACKING_TRACK_INFO_TABLE::insert( $tracking_number, $order_id, $carrier_slug, $service_carrier_type, '', '', '',
								$track_data['est_delivery_date'], '' );
							$response['tracking_service_status']  = 'error';
							$response['tracking_service_message'] = $track_data['data'];
						}
					} else {
						$need_update_tracking_table = true;
						if ( VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::convert_status( $tracking_from_db['status'] ) !== 'delivered' ) {
							$track_data = $easyPost->retrieve( $tracking_number );
							if ( $track_data['status'] === 'success' ) {
								if ( count( $track_data['data'] ) ) {
									$need_update_tracking_table           = false;
									$track_info                           = vi_wot_json_encode( $track_data['data'] );
									$last_event                           = array_shift( $track_data['data'] );
									$status                               = $last_event['status'];
									$current_tracking_data['status']      = $last_event['status'];
									$current_tracking_data['last_update'] = $now;
									VI_WOOCOMMERCE_ORDERS_TRACKING_TRACK_INFO_TABLE::update( $tracking_from_db['id'], $order_id, $carrier_slug, $service_carrier_type, $status,
										$track_info, $last_event['description'], $track_data['est_delivery_date'] );
									if ( $last_event['status'] !== $tracking_from_db['status'] || $track_info !== $tracking_from_db['track_info'] ) {
										$response['tracking_change'] = 1;
									}
								}
							} else {
								if ( $track_data['code'] === 404 ) {
									$track_data = $easyPost->create( $tracking_number, $find_carrier );
									if ( $track_data['status'] === 'success' ) {
										if ( count( $track_data['data'] ) ) {
											$track_info = vi_wot_json_encode( $track_data['data'] );
											$last_event = array_shift( $track_data['data'] );
											$status     = $last_event['status'];
											VI_WOOCOMMERCE_ORDERS_TRACKING_TRACK_INFO_TABLE::update( $tracking_from_db['id'], $order_id, $carrier_slug, $service_carrier_type,
												$status, $track_info, $last_event['description'], $track_data['est_delivery_date'] );
										}
									} else {
										$response['tracking_service_status']  = 'error';
										$response['tracking_service_message'] = $track_data['data'];
									}
								} else {
									$response['tracking_service_status']  = 'error';
									$response['tracking_service_message'] = $track_data['data'];
								}
							}
						} else {
							$current_tracking_data['status']      = $tracking_from_db['status'];
							$current_tracking_data['last_update'] = $tracking_from_db['modified_at'];
						}
						if ( $need_update_tracking_table && $order_id != $tracking_from_db['order_id'] || $service_carrier_type !== $tracking_from_db['carrier_service'] ) {
							VI_WOOCOMMERCE_ORDERS_TRACKING_TRACK_INFO_TABLE::update( $tracking_from_db['id'], $order_id, $carrier_slug, $service_carrier_type );
						}
					}

					break;
				case 'cainiao':
					$tracking_from_db = VI_WOOCOMMERCE_ORDERS_TRACKING_TRACK_INFO_TABLE::get_row_by_tracking_number( $tracking_number, $carrier_slug, $service_carrier_type,
						$order_id );
					if ( ! count( $tracking_from_db ) ) {
						VI_WOOCOMMERCE_ORDERS_TRACKING_TRACK_INFO_TABLE::insert( $tracking_number, $order_id, $carrier_slug, $service_carrier_type, '', '', '', '', '' );
					} elseif ( $order_id != $tracking_from_db['order_id'] || $carrier_slug != $tracking_from_db['carrier_id']
					           || $service_carrier_type != $tracking_from_db['carrier_service']
					) {
						VI_WOOCOMMERCE_ORDERS_TRACKING_TRACK_INFO_TABLE::update( $tracking_from_db['id'], $order_id, $carrier_slug, $service_carrier_type );
					}
					break;
				default:
			}
		}

		if ( $tracking_change && 'yes' === $send_mail ) {
			if ( VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_EMAIL::send_email( $order_id, array(
				array(
					'order_item_id'   => $item_id,
					'order_item_name' => $item_name,
					'tracking_number' => $tracking_number,
					'carrier_url'     => $carrier_url,
					'tracking_url'    => remove_query_arg( array( 'woo_orders_tracking_nonce' ), $tracking_url_import ),
					'carrier_name'    => $display_name,
					'quantity_index'  => $quantity_index,
				)
			), true )
			) {
				$response['message'] = esc_html__( 'Tracking saved and Email sent', 'woocommerce-orders-tracking' );
			}
		}
		if ( $tracking_change && 'yes' === $send_sms ) {
			VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_SMS::send_sms( $tracking_number, $display_name, $carrier_url,
				remove_query_arg( array( 'woo_orders_tracking_nonce' ), $tracking_url_import ), $order, $response, $add_new_tracking );
		}
		if ( $quantity_index < 2 ) {
			$item_tracking_data[] = $current_tracking_data;
			wc_update_order_item_meta( $item_id, '_vi_wot_order_item_tracking_data', vi_wot_json_encode( $item_tracking_data ) );
		} else {
			do_action( 'vi_woo_orders_tracking_single_edit_save_tracking_data', $current_tracking_data, $quantity_index, $item_id, $order_id );
		}
		$response['tracking_url_show'] = $tracking_url_import;
		/*Make sure order item tracking is saved before trigger status change*/
		if ( $change_order_status ) {
			$order->update_status( substr( $change_order_status, 3 ) );
			$order->save();
		}
		wp_send_json( $response );
	}

	/**
	 * @param $send_paypal
	 * @param $paypal_method
	 *
	 * @return array
	 */
	public function add_trackinfo_to_paypal( $send_paypal, $paypal_method ) {
		$credentials = VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_PAYPAL::get_api_credentials( $paypal_method );
		if ( $credentials['id'] && $credentials['secret'] ) {
			$result = VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_PAYPAL::add_tracking_number( $credentials['id'], $credentials['secret'], $send_paypal, $credentials['sandbox'] );
		} else {
			$result = array(
				'status' => 'error',
				'data'   => esc_html__( 'PayPal payment method not supported or missing API credentials', 'woocommerce-orders-tracking' )
			);
		}

		return $result;
	}

	/**
	 *
	 */
	public function orders_tracking_edit_tracking_footer() {
		$order_id = isset( $_REQUEST['post'] ) ? wp_unslash( $_REQUEST['post'] ) : '';
		if ( $order_id ) {
			$order = wc_get_order( $order_id );
			if ( $order ) {
				$countries = new WC_Countries();
				$countries = $countries->get_countries();
				?>
                <div class="<?php echo esc_attr( self::set( array(
					'edit-tracking-container',
					'edit-tracking-container-order-edit',
					'hidden'
				) ) ) ?>">
					<?php wp_nonce_field( 'vi_wot_item_action_nonce', '_vi_wot_item_nonce' ) ?>
                    <div class="<?php echo esc_attr( self::set( 'overlay' ) ) ?>"></div>
                    <div class="<?php echo esc_attr( self::set( 'edit-tracking-content' ) ) ?>">
                        <div class="<?php echo esc_attr( self::set( array(
							'edit-tracking-content-header',
							'edit-tracking-content-header-all'
						) ) ) ?>">
							<?php VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_ORDERS_TRACK_INFO::edit_tracking_content_header(); ?>
                        </div>
                        <div class="<?php echo esc_attr( self::set( 'edit-tracking-content-header' ) ) ?>">
                            <h2><?php esc_html_e( 'Edit tracking', 'woocommerce-orders-tracking' ) ?></h2>
                            <span class="<?php echo esc_attr( self::set( 'edit-tracking-close' ) ) ?>"></span>
                        </div>
                        <div class="<?php echo esc_attr( self::set( 'edit-tracking-content-body' ) ) ?>">
                            <div class="<?php echo esc_attr( self::set( 'edit-tracking-content-body-all' ) ) ?>">
								<?php VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_ORDERS_TRACK_INFO::edit_tracking_content_main_row(); ?>
                            </div>
                            <div class="<?php echo esc_attr( self::set( 'edit-tracking-content-body-single' ) ) ?>">
                                <div class="<?php echo esc_attr( self::set( array(
									'edit-tracking-content-body-row',
									'edit-tracking-content-body-row-error',
									'hidden'
								) ) ) ?>">
                                    <div class="<?php echo esc_attr( self::set( 'edit-tracking-content-body-row-item' ) ) ?>">
                                        <p class="description"></p>
                                    </div>
                                </div>
                                <div class="<?php echo esc_attr( self::set( array( 'edit-tracking-content-body-row' ) ) ) ?>">
                                    <div class="<?php echo esc_attr( self::set( 'edit-tracking-number-wrap' ) ) ?>">
                                        <label for="<?php echo esc_attr( self::set( 'edit-tracking-number' ) ) ?>">
											<?php esc_html_e( 'Tracking number', 'woocommerce-orders-tracking' ) ?>
                                        </label>
                                        <input type="text"
                                               id="<?php echo esc_attr( self::set( 'edit-tracking-number' ) ) ?>"
                                               class="<?php echo esc_attr( self::set( 'edit-tracking-number' ) ) ?>">
                                    </div>
                                    <div class="<?php echo esc_attr( self::set( 'edit-tracking-carrier-wrap' ) ) ?>">
                                        <label for="<?php echo esc_attr( self::set( 'edit-tracking-carrier' ) ) ?>"><?php esc_html_e( 'Tracking carrier',
												'woocommerce-orders-tracking' ) ?></label>
                                        <select name="<?php echo esc_attr( self::set( 'edit-tracking-carrier' ) ) ?>"
                                                id="<?php echo esc_attr( self::set( 'edit-tracking-carrier' ) ) ?>"
                                                class=" <?php echo esc_attr( self::set( 'edit-tracking-carrier' ) ) ?>">
                                            <option value="shipping-carriers"
                                                    selected><?php esc_html_e( 'Existing Carriers', 'woocommerce-orders-tracking' ) ?></option>
                                            <option value="other"><?php esc_html_e( 'Add new', 'woocommerce-orders-tracking' ) ?></option>
                                        </select>
                                    </div>
                                </div>
                                <div class="<?php echo esc_attr( self::set( array(
									'edit-tracking-content-body-row',
									'edit-tracking-content-body-row-shipping-carrier'
								) ) ) ?>">
                                    <div class="<?php echo esc_attr( self::set( 'edit-tracking-shipping-carrier-wrap' ) ) ?>">
                                        <label for="<?php echo esc_attr( self::set( 'edit-tracking-shipping-carrier' ) ) ?>"><?php esc_html_e( 'Shipping carrier',
												'woocommerce-orders-tracking' ) ?></label>
                                        <select name="<?php echo esc_attr( self::set( 'edit-tracking-shipping-carrier' ) ) ?>"
                                                id="<?php echo esc_attr( self::set( 'edit-tracking-shipping-carrier' ) ) ?>"
                                                class="<?php echo esc_attr( self::set( 'edit-tracking-shipping-carrier' ) ) ?> select2-hidden-accessible">

                                        </select>
                                    </div>
                                </div>
                                <div class="<?php echo esc_attr( self::set( array(
									'edit-tracking-content-body-row',
									'edit-tracking-content-body-row-other-carrier'
								) ) ) ?>">
                                    <div class="<?php echo esc_attr( self::set( 'edit-tracking-number-wrap' ) ) ?>">
                                        <label for="<?php echo esc_attr( self::set( 'edit-tracking-other-carrier-name' ) ) ?>">
											<?php esc_html_e( 'Carrier name', 'woocommerce-orders-tracking' ) ?>
                                        </label>
                                        <input type="text"
                                               id="<?php echo esc_attr( self::set( 'edit-tracking-other-carrier-name' ) ) ?>"
                                               class="<?php echo esc_attr( self::set( 'edit-tracking-other-carrier-name' ) ) ?>">
                                    </div>
                                    <div class="<?php echo esc_attr( self::set( 'edit-tracking-carrier-wrap' ) ) ?>">
                                        <label for="<?php echo esc_attr( self::set( 'edit-tracking-other-carrier-country' ) ) ?>"><?php esc_html_e( 'Shipping country',
												'woocommerce-orders-tracking' ) ?></label>
                                        <select name="<?php echo esc_attr( self::set( 'edit-tracking-other-carrier-country' ) ) ?>"
                                                id="<?php echo esc_attr( self::set( 'edit-tracking-other-carrier-country' ) ) ?>"
                                                class="<?php echo esc_attr( self::set( 'edit-tracking-other-carrier-country' ) ) ?> select2-hidden-accessible"
                                                tabindex="-1" aria-hidden="true">
                                            <option value=""></option>
                                            <option value="Global"
                                                    selected><?php esc_html_e( 'Global', 'woocommerce-orders-tracking' ) ?></option>
											<?php
											foreach ( $countries as $country_code => $country_name ) {
												?>
                                                <option value="<?php echo esc_attr( $country_code ) ?>"><?php echo esc_html( $country_name ) ?></option>
												<?php
											}
											?>
                                        </select>
                                    </div>
                                </div>
                                <div class="<?php echo esc_attr( self::set( array(
									'edit-tracking-content-body-row',
									'edit-tracking-content-body-row-other-carrier'
								) ) ) ?>">
                                    <div class="<?php echo esc_attr( self::set( 'edit-tracking-shipping-carrier-wrap' ) ) ?>">
                                        <label for="<?php echo esc_attr( self::set( 'edit-tracking-other-carrier-url' ) ) ?>"><?php esc_html_e( 'Carrier Tracking url',
												'woocommerce-orders-tracking' ) ?></label>
                                        <input type="text"
                                               id="<?php echo esc_attr( self::set( 'edit-tracking-other-carrier-url' ) ) ?>"
                                               placeholder="http://yourcarrier.com/{tracking_number}">
                                        <p class="description">
                                            {tracking_number}:<?php esc_html_e( 'The placeholder for tracking number of an item', 'woocommerce-orders-tracking' ) ?></p>
                                        <p class="description">
                                            {postal_code}:<?php esc_html_e( 'The placeholder for postal code of an order', 'woocommerce-orders-tracking' ) ?></p>
                                        <p class="description"><?php echo esc_html( 'eg: https://www.dhl.com/en/express/tracking.html?AWB={tracking_number}&brand=DHL' ); ?></p>
                                        <p class="description wotv-error-tracking-url"><?php esc_html_e( 'The tracking url will not include tracking number if carrier URL does not include ',
												'woocommerce-orders-tracking' ) ?>
                                            {tracking_number}</p>
                                    </div>
                                </div>
                            </div>
							<?php
							VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_ORDERS_TRACK_INFO::edit_tracking_content_options_row( $order );
							?>
                        </div>
                        <div class="<?php echo esc_attr( self::set( array(
							'edit-tracking-content-footer',
							'edit-tracking-content-footer-all'
						) ) ) ?>">
							<?php
							VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_ORDERS_TRACK_INFO::edit_tracking_content_footer();
							?>
                        </div>
                        <div class="<?php echo esc_attr( self::set( 'edit-tracking-content-footer' ) ) ?>">
                                <span class="button button-primary <?php echo esc_attr( self::set( 'edit-tracking-button-save' ) ) ?>">
                                    <?php esc_html_e( 'Save', 'woocommerce-orders-tracking' ) ?>
                                </span>
                            <span class="button <?php echo esc_attr( self::set( 'edit-tracking-button-cancel' ) ) ?>">
                                    <?php esc_html_e( 'Cancel', 'woocommerce-orders-tracking' ) ?>
                                </span>
                        </div>
                    </div>
                    <div class="<?php echo esc_attr( self::set( array( 'saving-overlay', 'hidden' ) ) ) ?>"></div>
                </div>
				<?php
			}
		}
	}

	public function woocommerce_hidden_order_itemmeta( $hidden_order_itemmeta ) {
		$hidden_order_itemmeta[] = '_vi_order_item_tracking_code';
		$hidden_order_itemmeta[] = '_vi_order_item_tracking_url';
		$hidden_order_itemmeta[] = '_vi_order_item_carrier_name';
		$hidden_order_itemmeta[] = '_vi_order_item_carrier_id';
		$hidden_order_itemmeta[] = '_vi_order_item_carrier_type';
		$hidden_order_itemmeta[] = '_vi_wot_order_item_tracking_data';
		$hidden_order_itemmeta[] = '_vi_wot_order_item_tracking_data_by_quantity';

		return $hidden_order_itemmeta;
	}

	/**
	 * @param $item_id
	 * @param $item WC_Order_Item_Product
	 * @param $product
	 *
	 * @throws Exception
	 */
	public function woocommerce_after_order_itemmeta( $item_id, $item, $product ) {
		if ( wp_doing_ajax() || ! is_a( $item, 'WC_Order_Item_Product' ) ) {
			return;
		}
		$order_id = $item->get_order_id();
		$order    = wc_get_order( $order_id );
		if ( $order ) {
			$transID               = $order->get_transaction_id();
			$paypal_method         = $order->get_payment_method();
			$item_tracking_data    = wc_get_order_item_meta( $item_id, '_vi_wot_order_item_tracking_data', true );
			$current_tracking_data = array(
				'tracking_number' => '',
				'carrier_slug'    => '',
				'carrier_url'     => '',
				'carrier_name'    => '',
				'carrier_type'    => '',
				'time'            => time(),
			);
			if ( $item_tracking_data ) {
				$item_tracking_data    = vi_wot_json_decode( $item_tracking_data );
				$current_tracking_data = array_pop( $item_tracking_data );
			}
			$manage_tracking = self::$settings->get_params( 'manage_tracking' );
			$tracking_number = apply_filters( 'vi_woo_orders_tracking_current_tracking_number', $current_tracking_data['tracking_number'], $item_id, $order_id );
			$carrier_slug    = apply_filters( 'vi_woo_orders_tracking_current_carrier_slug', $current_tracking_data['carrier_slug'], $item_id, $order_id );
			if ( apply_filters( 'vi_woo_orders_tracking_show_tracking_of_order_item', ( $manage_tracking !== 'order_only' || $tracking_number || $carrier_slug ), $item_id,
				$order_id )
			) {
				$carrier_url      = apply_filters( 'vi_woo_orders_tracking_current_tracking_url', $current_tracking_data['carrier_url'], $item_id, $order_id );
				$carrier_name     = apply_filters( 'vi_woo_orders_tracking_current_carrier_name', $current_tracking_data['carrier_name'], $item_id, $order_id );
				$digital_delivery = 0;
				$carrier          = self::$settings->get_shipping_carrier_by_slug( $current_tracking_data['carrier_slug'] );
				if ( is_array( $carrier ) && count( $carrier ) ) {
					$carrier_url  = $carrier['url'];
					$carrier_name = $carrier['name'];
					if ( $carrier['carrier_type'] === 'custom-carrier' && isset( $carrier['digital_delivery'] ) ) {
						$digital_delivery = $carrier['digital_delivery'];
					}
				}
				$tracking_url_show = apply_filters( 'vi_woo_orders_tracking_current_tracking_url_show',
					self::$settings->get_url_tracking( $carrier_url, $tracking_number, $carrier_slug, $order->get_shipping_postcode(), false, true, $order_id ), $item_id,
					$order_id );
				?>
                <div class="<?php echo esc_attr( self::set( 'container' ) ) ?>">
                    <div class="<?php echo esc_attr( self::set( 'item-details' ) ) ?>">
                        <div class="<?php echo esc_attr( self::set( 'item-tracking-code-label' ) ) ?>">
                            <span><?php esc_html_e( 'Tracking number', 'woocommerce-orders-tracking' ) ?></span>
                        </div>
                        <div class="<?php echo esc_attr( self::set( 'item-tracking-code-value' ) ) ?>"
                             title="<?php printf( esc_attr__( 'Tracking carrier %s', 'woocommerce-orders-tracking' ), esc_attr( $carrier_name ) ) // phpcs:ignore WordPress.WP.I18n.MissingTranslatorsComment?>">
                            <a href="<?php echo esc_url( $tracking_url_show ) ?>"
                               target="_blank"><?php echo esc_html( $tracking_number ) ?></a>
                        </div>
                        <div class="<?php echo esc_attr( self::set( 'item-tracking-button-edit-container' ) ) ?>">
                        <span class="dashicons dashicons-edit <?php echo esc_attr( self::set( 'button-edit' ) ) ?>"
                              data-tracking_number="<?php echo esc_attr( $tracking_number ) ?>"
                              data-tracking_url="<?php echo esc_attr( $carrier_url ) ?>"
                              data-carrier_name="<?php echo esc_attr( $carrier_name ) ?>"
                              data-digital_delivery="<?php echo esc_attr( $digital_delivery ) ?>"
                              data-carrier_id="<?php echo esc_attr( $carrier_slug ) ?>"
                              data-order_id="<?php echo esc_attr( $order_id ) ?>"
                              data-item_name="<?php echo esc_attr( $item->get_name() ) ?>"
                              data-item_id="<?php echo esc_attr( $item_id ) ?>"
                              data-quantity_index="1"
                              title="<?php echo esc_attr__( 'Edit tracking', 'woocommerce-orders-tracking' ) ?>"></span>
							<?php
							if ( $transID && in_array( $paypal_method, VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_PAYPAL::get_supported_paypal_gateways() ) ) {
								$paypal_added_trackings = $order->get_meta( 'vi_wot_paypal_added_tracking_numbers', true );
								if ( ! $paypal_added_trackings ) {
									$paypal_added_trackings = array();
								}
								$paypal_class = array( 'item-tracking-button-add-to-paypal-container' );
								if ( ! $tracking_number && $digital_delivery != 1 ) {
									$paypal_class[] = 'paypal-inactive';
									$title          = '';
								} else {
									if ( ! in_array( $tracking_number, $paypal_added_trackings ) ) {
										$paypal_class[] = 'paypal-active';
										$title          = esc_attr__( 'Add this tracking number to PayPal', 'woocommerce-orders-tracking' );
									} else {
										$paypal_class[] = 'paypal-inactive';
										$title          = esc_attr__( 'This tracking number was added to PayPal', 'woocommerce-orders-tracking' );
									}
								}

								?>
                                <span class="<?php echo esc_attr( self::set( $paypal_class ) ) ?>"
                                      data-item_id="<?php echo esc_attr( $item_id ) ?>"
                                      data-order_id="<?php echo esc_attr( $order_id ) ?>"><img
                                            class="<?php echo esc_attr( self::set( 'item-tracking-button-add-to-paypal' ) ) ?>"
                                            title="<?php echo esc_attr( $title ) ?>"
                                            src="<?php echo esc_url( VI_WOOCOMMERCE_ORDERS_TRACKING_PAYPAL_IMAGE ) ?>">
                                </span>
								<?php
							}
							?>
                        </div>
                    </div>
                    <div class="<?php echo esc_attr( self::set( 'error' ) ) ?>"></div>
                </div>
				<?php
			}
		}
	}

	/**
	 * Add tracking data metabox below order actions metabox
	 */
	public function order_details_add_meta_boxes() {
		global $pagenow;
		$page = isset($_GET['page']) ? wc_clean(wp_unslash($_GET['page'])):'';
		if ( $pagenow === 'post.php' || $page === 'wc-orders') {
			add_meta_box(
				'vi_wotv_edit_order_tracking',
				esc_html__( 'Tracking data', 'woocommerce-orders-tracking' ),
				array( $this, 'add_meta_box_callback' ),
				$page === 'wc-orders'?'woocommerce_page_wc-orders' :'shop_order',
				'side',
				'core'
			);
		}
	}

	/**
	 * Show all tracking numbers like tracking number column on orders list page + edit button
	 */
	public function add_meta_box_callback() {
		global $theorder;
		$order=null;
		if ($theorder){
			$order    = wc_get_order( $theorder );
		}
		if (!$order) {
			$page     = isset( $_GET['page'] ) ? wc_clean( wp_unslash( $_GET['page'] ) ) : '';
			$order_id = $page === 'wc-orders' && ! empty( $_GET['id'] ) ? wc_clean( wp_unslash( $_GET['id'] ) ) : 0;
			if ( ! $order_id ) {
				global $post;
				$order_id = $post ? $post->ID : 0;
			}
			$order = wc_get_order( $order_id );
		}
		if ( $order && !empty($order->get_items()) ) {
			$order_id = $order->get_id();
			VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_ORDERS_TRACK_INFO::tracking_number_column_html( $order_id );
			?>
            <div>
                <p class="<?php echo esc_attr( self::set( 'edit-order-tracking-container-all' ) ) ?>">
                        <span class="button <?php echo esc_attr( self::set( 'edit-order-tracking-all' ) ) ?>"
                              data-order_id="<?php echo esc_attr( $order_id ) ?>"
                              title="<?php echo esc_attr__( 'Manage all tracking numbers', 'woocommerce-orders-tracking' ) ?>"><span
                                    class="dashicons dashicons-edit"></span><?php esc_html_e( 'Edit tracking', 'woocommerce-orders-tracking' ) ?>
                        </span>
                </p>
            </div>
			<?php
		}
	}
}