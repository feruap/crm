<?php

/**
 * Class VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_IMPORT_CSV
 *
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_IMPORT_CSV {
	protected static $settings;
	protected $process;
	protected $request;
	protected $step;
	protected $file_url;
	protected $header;
	protected $error;
	protected $index;
	protected $orders_per_request;
	protected $nonce;
	protected $carriers;

	public function __construct() {
		self::$settings = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_instance();
		$this->carriers = array();
		add_action( 'admin_menu', array( $this, 'add_menu' ), 19 );
		add_action( 'admin_enqueue_scripts', array( $this, 'admin_enqueue_scripts' ) );
		add_action( 'admin_init', array( $this, 'import_csv' ) );
		add_action( 'wp_ajax_woo_orders_tracking_import', array( $this, 'import' ) );
		add_action( 'vi_wot_importer_scheduled_cleanup', array(
			$this,
			'scheduled_cleanup'
		) );
		add_action( 'vi_wot_send_mail_tracking_code', array( $this, 'vi_wot_send_mail_tracking_code' ) );
		add_action( 'vi_wot_send_mails_for_import_csv_function', array( $this, 'send_mails_for_import_csv_function' ) );
	}

	/**html tag attribute
	 *
	 * @param      $name
	 * @param bool $set_name
	 *
	 * @return string
	 */
	public static function set( $name, $set_name = false ) {
		return VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::set( $name, $set_name );
	}

	/**Delete csv file after 24 hours
	 *
	 * @param $attachment_id
	 */
	public function scheduled_cleanup( $attachment_id ) {
		if ( $attachment_id ) {
			wp_delete_attachment( $attachment_id, true );
		}
	}

	public function add_menu() {
		add_submenu_page(
			'woocommerce-orders-tracking', esc_html__( 'Import Tracking', 'woocommerce-orders-tracking' ), esc_html__( 'Import Tracking', 'woocommerce-orders-tracking' ),
			VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_required_capability( 'import' ), 'woo-orders-tracking-import-csv', array(
				$this,
				'import_csv_callback'
			)
		);
	}

	public function sanitize_text_field( $value ) {
		return sanitize_text_field( urldecode( $value ) );
	}

	/**
	 * Upload csv file and preprocess data
	 */
	public function import_csv() {
		global $pagenow;
		if ( ! current_user_can( VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_required_capability( 'import' ) ) ) {
			return;
		}
		$page = isset( $_GET['page'] ) ? wp_unslash( $this->sanitize_text_field( $_GET['page'] ) ) : '';
		if ( $pagenow === 'admin.php' && $page === 'woo-orders-tracking-import-csv' ) {
			$this->step     = isset( $_REQUEST['step'] ) ? sanitize_text_field( $_REQUEST['step'] ) : '';
			$this->file_url = get_transient('vi_wot_importer_file');
			if ($this->file_url){
				$this->file_url = urldecode_deep($this->file_url);
			}
			if ( $this->step === 'mapping' ) {
				if ( is_file( $this->file_url ) ) {
					if ( ( $order_id = fopen( $this->file_url, 'r' ) ) !== false ) {
						$this->header = fgetcsv( $order_id, 0, ',' );
						fclose( $order_id );
						if ( ! count( $this->header ) ) {
							$this->step  = '';
							$this->error = esc_html__( 'Invalid file.', 'woocommerce-orders-tracking' );
						}
					} else {
						$this->step  = '';
						$this->error = esc_html__( 'Invalid file.', 'woocommerce-orders-tracking' );
					}
				} else {
					$this->step  = '';
					$this->error = esc_html__( 'Invalid file.', 'woocommerce-orders-tracking' );
				}
			}

			if ( ! isset( $_POST['_woo_orders_tracking_import_nonce'] )
			     || ! wp_verify_nonce( wp_unslash( $this->sanitize_text_field( $_POST['_woo_orders_tracking_import_nonce'] ) ), 'woo_orders_tracking_import_action_nonce' )
			) {
				return;
			}
			if ( isset( $_POST['woo_orders_tracking_import'] ) ) {
				$this->step     = 'import';
//				$this->file_url = isset( $_POST['woo_orders_tracking_file_url'] ) ? wp_unslash( $_POST['woo_orders_tracking_file_url'] ) : '';
				$this->nonce    = isset( $_POST['_woo_orders_tracking_import_nonce'] ) ? sanitize_text_field( $_POST['_woo_orders_tracking_import_nonce'] ) : '';
				$map_to         = isset( $_POST['woo_orders_tracking_map_to'] ) ? array_map( array(
					'VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_IMPORT_CSV',
					'sanitize_text_field'
				), $_POST['woo_orders_tracking_map_to'] ) : array();
				if ( is_file( $this->file_url ) ) {
					if ( ( $file_handle = fopen( $this->file_url, 'r' ) ) !== false ) {
						$header  = fgetcsv( $file_handle, 0, ',' );
						$headers = array(
							'order_id'        => esc_html__( 'Order ID', 'woocommerce-orders-tracking' ),
							'tracking_number' => esc_html__( 'Tracking Number', 'woocommerce-orders-tracking' ),
							'carrier_slug'    => esc_html__( 'Carrier Slug', 'woocommerce-orders-tracking' ),
							'order_item_id'   => esc_html__( 'Order Item ID', 'woocommerce-orders-tracking' ),
							'order_status'    => esc_html__( 'Order Status', 'woocommerce-orders-tracking' ),
						);
						$index   = array();
						foreach ( $headers as $header_k => $header_v ) {
							$field_index = array_search( $map_to[ $header_k ], $header );
							if ( $field_index === false ) {
								$index[ $header_k ] = - 1;
							} else {
								$index[ $header_k ] = $field_index;
							}
						}
						$required_fields = array(
							'order_id',
							'tracking_number',
							'carrier_slug',
						);

						foreach ( $required_fields as $required_field ) {
							if ( 0 > $index[ $required_field ] ) {
								wp_safe_redirect( add_query_arg( array( 'vi_wot_error' => 1 ),
									admin_url( 'admin.php?page=woo-orders-tracking-import-csv&step=mapping' ) ) );
								exit();
							}
						}

						$this->index = $index;
					} else {
						wp_safe_redirect( add_query_arg( array( 'vi_wot_error' => 2 ),
							admin_url( 'admin.php?page=woo-orders-tracking-import-csv' ) ) );
						exit();
					}
				} else {
					wp_safe_redirect( add_query_arg( array( 'vi_wot_error' => 3 ),
						admin_url( 'admin.php?page=woo-orders-tracking-import-csv'  ) ) );
					exit();
				}

			} else if ( isset( $_POST['woo_orders_tracking_select_file'] ) ) {
				if ( ! isset( $_FILES['woo_orders_tracking_file'] ) ) {
					$error = new WP_Error( 'woo_orders_tracking_csv_importer_upload_file_empty',
						esc_html__( 'File is empty. Please upload something more substantial. This error could also be caused by uploads being disabled in your php.ini or by post_max_size being defined as smaller than upload_max_filesize in php.ini.',
							'woocommerce-orders-tracking' ) );
					wp_die( wp_kses_post($error->get_error_messages()) );
				} elseif ( ! empty( $_FILES['woo_orders_tracking_file']['error'] ) ) {
					$error = new WP_Error( 'woo_orders_tracking_csv_importer_upload_file_error', esc_html__( 'File is error.', 'woocommerce-orders-tracking' ) );
					wp_die( wp_kses_post($error->get_error_messages()) );
				} else {
					$import    = $_FILES['woo_orders_tracking_file'];
					$overrides = array(
						'test_form' => false,
						'mimes'     => array(
							'csv' => 'text/csv',
						),
						'test_type' => true,
					);
					$upload    = wp_handle_upload( $import, $overrides );
					if ( isset( $upload['error'] ) ) {
						wp_die( wp_kses_post($upload['error']) );
					}
					// Construct the object array.
					$object = array(
						'post_title'     => basename( $upload['file'] ),
						'post_content'   => $upload['url'],
						'post_mime_type' => $upload['type'],
						'guid'           => $upload['url'],
						'context'        => 'import',
						'post_status'    => 'private',
					);

					// Save the data.
					$id = wp_insert_attachment( $object, $upload['file'] );
					if ( is_wp_error( $id ) ) {
						wp_die( wp_kses_post($id->get_error_messages()) );
					}
					/*
					 * Schedule a cleanup for one day from now in case of failed
					 * import or missing wp_import_cleanup() call.
					 */
					wp_schedule_single_event( time() + DAY_IN_SECONDS, 'vi_wot_importer_scheduled_cleanup', array( $id ) );
					set_transient('vi_wot_importer_file',urlencode( $upload['file'] ),86400);
					wp_safe_redirect( add_query_arg( array(
						'step'     => 'mapping',
					) ) );
					exit();
				}
			} elseif ( isset( $_POST['woo_orders_tracking_download_carriers_file'] ) ) {
				$custom_carriers               = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_custom_carriers();
				$shipping_carriers_define_list = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_defined_carriers();
				$filename                      = 'carriers.csv';
				$data_rows                     = array();
				$header_row                    = array(
					esc_html__( 'Carrier Name', 'woocommerce-orders-tracking' ),
					esc_html__( 'Carrier Slug', 'woocommerce-orders-tracking' )
				);
				if ( count( $custom_carriers ) ) {
					foreach ( $custom_carriers as $carrier ) {
						$data_rows[] = array( $carrier['name'], $carrier['slug'] );
					}
				}
				if ( count( $shipping_carriers_define_list ) ) {
					foreach ( $shipping_carriers_define_list as $carrier ) {
						$data_rows[] = array( $carrier['name'], $carrier['slug'] );
					}
				}

				$fh = @fopen( 'php://output', 'w' );
				fprintf( $fh, chr( 0xEF ) . chr( 0xBB ) . chr( 0xBF ) );
				header( 'Cache-Control: must-revalidate, post-check=0, pre-check=0' );
				header( 'Content-Description: File Transfer' );
				header( 'Content-type: text/csv' );
				header( 'Content-Disposition: attachment; filename=' . $filename );
				header( 'Expires: 0' );
				header( 'Pragma: public' );
				fputcsv( $fh, $header_row );
				foreach ( $data_rows as $data_row ) {
					fputcsv( $fh, $data_row );

				}
				$csvFile = stream_get_contents( $fh );
				fclose( $fh );
				die();
			} elseif ( isset( $_POST['woo_orders_tracking_download_demo_file'] ) ) {
				$filename   = 'Import file example.csv';
				$header_row = array(
					'order_id'        => esc_html__( 'Order ID', 'woocommerce-orders-tracking' ),
					'order_item_id'   => esc_html__( 'Order Item ID', 'woocommerce-orders-tracking' ),
					'tracking_number' => esc_html__( 'Tracking Number', 'woocommerce-orders-tracking' ),
					'carrier_slug'    => esc_html__( 'Carrier Slug', 'woocommerce-orders-tracking' ),
					'order_status'    => esc_html__( 'Order Status', 'woocommerce-orders-tracking' ),
				);
				$data_rows  = array(
					array(
						'111',
						'123',
						'tracking_number1',
						'dhl-logistics',
						'completed',
					),
					array(
						'111',
						'124',
						'tracking_number2',
						'dhl-logistics',
						'completed',
					),
					array(
						'112',
						'133',
						'tracking_number3',
						'dhl-logistics',
						'completed',
					),
					array(
						'112',
						'134',
						'tracking_number4',
						'dhl-logistics',
						'completed',
					),
				);
				$fh         = @fopen( 'php://output', 'w' );
				fprintf( $fh, chr( 0xEF ) . chr( 0xBB ) . chr( 0xBF ) );
				header( 'Cache-Control: must-revalidate, post-check=0, pre-check=0' );
				header( 'Content-Description: File Transfer' );
				header( 'Content-type: text/csv' );
				header( 'Content-Disposition: attachment; filename=' . $filename );
				header( 'Expires: 0' );
				header( 'Pragma: public' );
				fputcsv( $fh, $header_row );
				foreach ( $data_rows as $data_row ) {
					fputcsv( $fh, $data_row );

				}
				$csvFile = stream_get_contents( $fh );
				fclose( $fh );
				die();
			}

		}
	}

	private static function error_log( $api_error, $service_carrier_type, $tracking_number, $order_id ) {
		if ( $api_error ) {
			$service_carrier_name = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::service_carriers_list( $service_carrier_type );
			if ( $order_id ) {
				$log = esc_html( "Error adding tracking number {$tracking_number} to {$service_carrier_name} for order #{$order_id}: {$api_error}");
			} else {
				$log = esc_html( "Error adding tracking number {$tracking_number} to {$service_carrier_name}: {$api_error}");
			}
			self::wc_log( $log, WC_Log_Levels::NOTICE );
		}
	}

	/**Save tracking to database for an order
	 *
	 * @param $order_id
	 * @param $data
	 * @param $import_options
	 * @param $changed_orders
	 * @param $paypal
	 * @param $ppec_paypal
	 * @param $bulk_tracking_service_orders
	 *
	 * @throws Exception
	 */
	public function import_tracking( $order_id, $data, $import_options, &$changed_orders, &$paypal, &$ppec_paypal, &$bulk_tracking_service_orders ) {
		if ( $order_id && count( $data ) ) {
			$order_status           = $import_options['order_status'];
			$paypal_enable          = $import_options['paypal_enable'];
			$map_order_item         = $import_options['map_order_item'];
			$order                  = wc_get_order( $order_id );
			$service_carrier_type   = self::$settings->get_params( 'service_carrier_type' );
			$service_carrier_enable = self::$settings->get_params( 'service_carrier_enable' );
			$manage_tracking        = self::$settings->get_params( 'manage_tracking' );
			$track_per_quantity     = self::$settings->get_params( 'track_per_quantity' );
			if ( $manage_tracking === 'order_only' ) {
				$track_per_quantity = false;
			}
			if ( $order ) {
				$line_items    = $order->get_items();
				$change        = 0;
				$paypal_order  = array();
				$transID       = $order->get_transaction_id();
				$paypal_method = $order->get_payment_method();
				if ( count( $line_items ) ) {
					$set_tracking_for_order = false;
					if ( $map_order_item > - 1 ) {
						$processed_items = array();
						foreach ( $data as $item ) {
							$item_id         = $item['order_item_id'];
							$tracking_number = $item['tracking_number'];
							$carrier_slug    = $item['carrier_slug'];
							if ( ! $tracking_number || ! $carrier_slug ) {
								$processed_items[] = $item;
								continue;
							}
							$quantity_index = 1;
							if ( $track_per_quantity && $item_id ) {
								$quantity_index += count( array_keys( array_column( $processed_items, 'order_item_id' ), $item_id ) );
							}
							$carrier = self::$settings->get_shipping_carrier_by_slug( $carrier_slug );
							if ( is_array( $carrier ) && count( $carrier ) ) {
								$carrier_name = $carrier['name'];
								if ( $item_id ) {
									$result = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::set_tracking( $order_id, $tracking_number, $carrier_slug, $item_id, $quantity_index, false,
										false, false, false );
									if ( $result['is_updated'] ) {
										$change ++;
									}
									if ( ! $result['error'] ) {
										if ( empty( $paypal_order ) && $paypal_enable && $transID ) {
											$paypal_order = array(
												'trans_id'        => $transID,
												'carrier_name'    => $carrier_name,
												'tracking_number' => $tracking_number,
												'order_id'        => $order_id,
											);
										}
										if ( $service_carrier_enable ) {
											switch ( $service_carrier_type ) {
												case 'trackingmore':
													$bulk_tracking_service_orders[] = array(
														'carrier_id'            => $carrier_slug,
														'tracking_more_slug'    => empty( $carrier['tracking_more_slug'] )
															? VI_WOOCOMMERCE_ORDERS_TRACKING_TRACKINGMORE::get_carrier_slug_by_name( $carrier_name )
															: $carrier['tracking_more_slug'],
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
													$bulk_tracking_service_orders[] = array(
														'carrier_name'    => $carrier_name,
														'tracking_number' => $tracking_number,
													);
													break;
												default:
													VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::add_tracking_to_service( $tracking_number, $carrier_slug, $carrier_name, $order_id,
														$api_error );
													self::error_log( $api_error, $service_carrier_type, $tracking_number, $order_id );
											}
										}
									} else {
										self::wc_log( "Order #{$order_id}, item {$item_id}: {$result['error']}",WC_Log_Levels::NOTICE );
									}
								} elseif ( $manage_tracking !== 'items_only' && ! $set_tracking_for_order ) {
									$old_tracking_number  = $order->get_meta( '_wot_tracking_number', true );
									$old_tracking_carrier = $order->get_meta( '_wot_tracking_carrier', true );
									if ( $tracking_number != $old_tracking_number || $carrier_slug !== $old_tracking_carrier ) {
										$tracking_exists = false;
										foreach ( $line_items as $item_id => $line_item ) {
											$item_tracking_data = wc_get_order_item_meta( $item_id, '_vi_wot_order_item_tracking_data', true );
											if ( $item_tracking_data ) {
												$item_tracking_data    = vi_wot_json_decode( $item_tracking_data );
												$current_tracking_data = array_pop( $item_tracking_data );
												if ( $current_tracking_data['tracking_number'] == $tracking_number && $current_tracking_data['carrier_slug'] === $carrier_slug ) {
													$tracking_exists = true;
													break;
												}
											}
										}
										if ( ! $tracking_exists ) {
											$set_tracking_for_order = true;
											$change ++;
											$order->update_meta_data( '_wot_tracking_number', $tracking_number );
											$order->update_meta_data( '_wot_tracking_carrier', $carrier_slug );
											$order->update_meta_data( '_wot_tracking_status', '' );
											$order->save_meta_data();
											if ( $paypal_enable && $transID ) {
												$paypal_order = array(
													'trans_id'        => $transID,
													'carrier_name'    => $carrier_name,
													'tracking_number' => $tracking_number,
													'order_id'        => $order_id,
												);
											}
											if ( $service_carrier_enable ) {
												switch ( $service_carrier_type ) {
													case 'trackingmore':
														$bulk_tracking_service_orders[] = array(
															'carrier_id'            => $carrier_slug,
															'tracking_more_slug'    => empty( $carrier['tracking_more_slug'] )
																? VI_WOOCOMMERCE_ORDERS_TRACKING_TRACKINGMORE::get_carrier_slug_by_name( $carrier_name )
																: $carrier['tracking_more_slug'],
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
														$bulk_tracking_service_orders[] = array(
															'carrier_name'    => $carrier_name,
															'tracking_number' => $tracking_number,
														);
														break;
													default:
														VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::add_tracking_to_service( $tracking_number, $carrier_slug, $carrier_name, $order_id,
															$api_error );
														self::error_log( $api_error, $service_carrier_type, $tracking_number, $order_id );
												}
											}
											do_action( 'woo_orders_tracking_updated_order_tracking_data', $order_id, $tracking_number, $carrier );
										}
									}
								}
							} else {
								self::wc_log(  "Order #{$order_id}: invalid carrier slug {$carrier_slug}", WC_Log_Levels::NOTICE );
							}
							$processed_items[] = $item;
						}
					} else {
						foreach ( $data as $item ) {
							$tracking_number = $item['tracking_number'];
							$carrier_slug    = $item['carrier_slug'];
							if ( ! $tracking_number || ! $carrier_slug ) {
								continue;
							}
							$carrier = self::$settings->get_shipping_carrier_by_slug( $carrier_slug );
							if ( is_array( $carrier ) && count( $carrier ) ) {
								$carrier_url  = $carrier['url'];
								$carrier_name = $carrier['name'];
								$carrier_type = isset( $carrier['carrier_type'] ) ? $carrier['carrier_type'] : '';
								if ( $service_carrier_enable ) {
									switch ( $service_carrier_type ) {
										case 'trackingmore':
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
											$bulk_tracking_service_orders[] = array(
												'carrier_name'    => $carrier_name,
												'tracking_number' => $tracking_number,
											);
											break;
										default:
											VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::add_tracking_to_service( $tracking_number, $carrier_slug, $carrier_name, $order_id, $api_error );
											self::error_log( $api_error, $service_carrier_type, $tracking_number, $order_id );
									}
								}
								if ( $paypal_enable && $transID ) {
									$paypal_order = array(
										'trans_id'        => $transID,
										'carrier_name'    => $carrier_name,
										'tracking_number' => $tracking_number,
										'order_id'        => $order_id,
									);
								}
								if ( $manage_tracking === 'items_only' ) {
									foreach ( $line_items as $item_id => $line_item ) {
										$item_tracking_data    = wc_get_order_item_meta( $item_id, '_vi_wot_order_item_tracking_data', true );
										$current_tracking_data = array(
											'tracking_number' => '',
											'carrier_slug'    => '',
											'carrier_url'     => '',
											'carrier_name'    => '',
											'carrier_type'    => '',
											'time'            => time(),
										);
										$tracking_change       = true;
										if ( $item_tracking_data ) {
											$item_tracking_data = vi_wot_json_decode( $item_tracking_data );
											foreach ( $item_tracking_data as $order_tracking_data_k => $order_tracking_data_v ) {
												if ( $order_tracking_data_v['tracking_number'] == $tracking_number ) {
													$current_tracking_data = $order_tracking_data_v;
													if ( $current_tracking_data['carrier_url'] == $carrier_url
													     && $order_tracking_data_k === ( count( $item_tracking_data ) - 1 )
													) {
														$tracking_change = false;
													}
													unset( $item_tracking_data[ $order_tracking_data_k ] );
													break;
												}
											}
											$item_tracking_data = array_values( $item_tracking_data );
										} else {
											$item_tracking_data = array();
										}

										$current_tracking_data['tracking_number'] = $tracking_number;
										$current_tracking_data['carrier_slug']    = $carrier_slug;
										$current_tracking_data['carrier_url']     = $carrier_url;
										$current_tracking_data['carrier_name']    = $carrier_name;
										$current_tracking_data['carrier_type']    = $carrier_type;
										if ( $tracking_change ) {
											$current_tracking_data['status'] = '';
										}
										$item_tracking_data[] = $current_tracking_data;
										wc_update_order_item_meta( $item_id, '_vi_wot_order_item_tracking_data', vi_wot_json_encode( $item_tracking_data ) );

										if ( $tracking_change ) {
											$change ++;
										}
									}
								} else {
									$old_tracking_number  = $order->get_meta( '_wot_tracking_number', true );
									$old_tracking_carrier = $order->get_meta( '_wot_tracking_carrier', true );
									if ( $tracking_number != $old_tracking_number || $carrier_slug !== $old_tracking_carrier ) {
										$tracking_exists = false;
										foreach ( $line_items as $item_id => $line_item ) {
											$item_tracking_data = wc_get_order_item_meta( $item_id, '_vi_wot_order_item_tracking_data', true );
											if ( $item_tracking_data ) {
												$item_tracking_data    = vi_wot_json_decode( $item_tracking_data );
												$current_tracking_data = array_pop( $item_tracking_data );
												if ( $current_tracking_data['tracking_number'] == $tracking_number && $current_tracking_data['carrier_slug'] === $carrier_slug ) {
													$tracking_exists = true;
												}
											}
										}
										if ( ! $tracking_exists ) {
											$change ++;
											$order->update_meta_data( '_wot_tracking_number', $tracking_number );
											$order->update_meta_data( '_wot_tracking_carrier', $carrier_slug );
											$order->update_meta_data( '_wot_tracking_status', '' );
											$order->save_meta_data();
											do_action( 'woo_orders_tracking_updated_order_tracking_data', $order_id, $tracking_number, $carrier );
										}
									}
								}
								break;
							} else {
								self::wc_log( esc_html( "Order #{$order_id}: invalid carrier slug {$carrier_slug}"), WC_Log_Levels::NOTICE );
							}
						}
					}
				}
				if ( $change > 0 ) {
					if ( $order_status ) {
						$order_status   = strtolower( $order_status );
						$order_statuses = wc_get_order_statuses();
						if ( isset( $order_statuses[ $order_status ] ) ) {
							$order->update_status( substr( $order_status, 3 ) );
							$order->save();
						}
					}
					$changed_orders[] = $order_id;
					self::wc_log( esc_html( "Import tracking successfully for order #{$order_id}" ) );
				}
				if ( ! empty( $paypal_order ) && in_array( $paypal_method, VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_PAYPAL::get_supported_paypal_gateways() ) ) {
					$paypal_order['method_id'] = $paypal_method;
					$paypal[]                  = $paypal_order;
				}
			} else {
				self::wc_log( esc_html( "Order #{$order_id}: invalid order" ), WC_Log_Levels::NOTICE );
			}
			/**
			 * Check total tracking numbers to add to TrackingMore or 17track each time saving tracking for an order
			 */
			if ( count( $bulk_tracking_service_orders ) >= 40 ) {
				$tracking_more_orders_send = array_splice( $bulk_tracking_service_orders, 0, 40 );
				VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::bulk_add_tracking_to_service( $tracking_more_orders_send, $api_errors );
				if ( count( $api_errors ) ) {
					foreach ( $api_errors as $api_error ) {
						self::error_log( $api_error['api_error'], $api_error['service_carrier_type'], $api_error['tracking_number'], $api_error['order_id'] );
					}
				}
			}
		}
	}

	/**Handle items left before finishing
	 *
	 * @param $bulk_tracking_service_orders
	 */
	public function bulk_add_tracking_numbers_last_items( &$bulk_tracking_service_orders ) {
		$count = count( $bulk_tracking_service_orders );
		if ( $count > 0 ) {
			$max = ceil( $count / 40 );
			if ( $max > 0 ) {
				for ( $i = 0; $i < $max; $i ++ ) {
					$tracking_more_orders_send = array_splice( $bulk_tracking_service_orders, 0, 40 );
					VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::bulk_add_tracking_to_service( $tracking_more_orders_send, $api_errors );
					if ( count( $api_errors ) ) {
						foreach ( $api_errors as $api_error ) {
							self::error_log( $api_error['api_error'], $api_error['service_carrier_type'], $api_error['tracking_number'], $api_error['order_id'] );
						}
					}
					sleep( 1 );
				}
			}
		}
	}

	/**
	 * Handle ajax import
	 *
	 * @throws Exception
	 */
	public function import() {
		if ( ! current_user_can( VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_required_capability( 'import' ) ) ) {
			wp_send_json(
				array(
					'status'  => 'error',
					'message' => esc_html__( 'You do not have permission.', 'woocommerce-orders-tracking' ),
				)
			);
		}
		$file_url = get_transient('vi_wot_importer_file');
		if ($file_url){
			$file_url = urldecode_deep($file_url);
		}
		$start                        = isset( $_POST['start'] ) ? absint( sanitize_text_field( $_POST['start'] ) ) : 0;
		$ftell                        = isset( $_POST['ftell'] ) ? absint( sanitize_text_field( $_POST['ftell'] ) ) : 0;
		$total                        = isset( $_POST['total'] ) ? absint( sanitize_text_field( $_POST['total'] ) ) : 0;
		$step                         = isset( $_POST['step'] ) ? sanitize_text_field( $_POST['step'] ) : '';
		$index                        = isset( $_POST['vi_wot_index'] ) ? array_map( 'intval', $_POST['vi_wot_index'] ) : array();
		$orders_per_request           = isset( $_POST['orders_per_request'] ) ? absint( sanitize_text_field( $_POST['orders_per_request'] ) ) : 1;
		$email_enable                 = isset( $_POST['email_enable'] ) ? sanitize_text_field( $_POST['email_enable'] ) : '';
		$order_status                 = isset( $_POST['order_status'] ) ? sanitize_text_field( $_POST['order_status'] ) : '';
		$paypal_enable                = isset( $_POST['paypal_enable'] ) ? sanitize_text_field( $_POST['paypal_enable'] ) : '';
		$bulk_tracking_service_orders = isset( $_POST['tracking_more_orders'] ) ? sanitize_text_field( stripslashes( $_POST['tracking_more_orders'] ) ) : '';
		$changed_orders               = isset( $_POST['changed_orders'] ) ? sanitize_text_field( stripslashes( $_POST['changed_orders'] ) ) : '';
		$paypal                       = isset( $_POST['paypal'] ) ? sanitize_text_field( stripslashes( $_POST['paypal'] ) ) : '';
		$ppec_paypal                  = isset( $_POST['ppec_paypal'] ) ? sanitize_text_field( stripslashes( $_POST['ppec_paypal'] ) ) : '';
		if ( $bulk_tracking_service_orders ) {
			$bulk_tracking_service_orders = vi_wot_json_decode( $bulk_tracking_service_orders );
		} else {
			$bulk_tracking_service_orders = array();
		}
		if ( $changed_orders ) {
			$changed_orders = vi_wot_json_decode( $changed_orders );
		} else {
			$changed_orders = array();
		}
		if ( $paypal ) {
			$paypal = vi_wot_json_decode( $paypal );
		} else {
			$paypal = array();
		}
		if ( $ppec_paypal ) {
			$ppec_paypal = vi_wot_json_decode( $ppec_paypal );
		} else {
			$ppec_paypal = array();
		}

		$paypal_transaction_per_request = 20;
		switch ( $step ) {
			case 'check':
				if ( is_file( $file_url ) ) {
					if ( ( $file_handle = fopen( $file_url, 'r' ) ) !== false ) {
						$header = fgetcsv( $file_handle, 0, ',' );
						unset( $header );
						$options                       = self::$settings->get_params();
						$options['orders_per_request'] = $orders_per_request;
						$options['email_enable']       = $email_enable;
						$options['order_status']       = $order_status;
						$options['paypal_enable']      = $paypal_enable;
						update_option( 'woo_orders_tracking_settings', $options );
						$count = 1;
						while ( ( $item = fgetcsv( $file_handle, 0, ',' ) ) !== false ) {
							$count ++;
						}
						$total = $count;
						fclose( $file_handle );
						if ( $total > 1 ) {
							if ( $total > $start ) {
								self::wc_log( esc_html( 'Start importing tracking') );
								wp_send_json( array(
									'status'  => 'success',
									'total'   => $total,
									'message' => '',
								) );
							} else {
								self::wc_log( esc_html( "Error: Start at row must be smaller than {($total-1)}" ), WC_Log_Levels::NOTICE );
								wp_send_json( array(
									'status'  => 'error',
									'total'   => $total,
									'message' => sprintf(esc_html__( "Start at row must be smaller than %s", 'woocommerce-orders-tracking' ), $total-1),// phpcs:ignore WordPress.WP.I18n.MissingTranslatorsComment
								) );
							}
						} else {
							self::wc_log( esc_html( 'No data' ), WC_Log_Levels::NOTICE );
							wp_send_json( array(
								'status'  => 'error',
								'total'   => $total,
								'message' => esc_html__( 'No data', 'woocommerce-orders-tracking' ),
							) );
						}

					} else {
						wp_send_json(
							array(
								'status'  => 'error',
								'message' => esc_html__( 'Invalid file.', 'woocommerce-orders-tracking' ),
							)
						);
					}
				} else {
					wp_send_json(
						array(
							'status'  => 'error',
							'message' => esc_html__( 'Invalid file.', 'woocommerce-orders-tracking' ),
						)
					);
				}
				break;
			case 'import':
				if ( is_file( $file_url ) ) {
					if ( ( $file_handle = fopen( $file_url, 'r' ) ) !== false ) {
						$header = fgetcsv( $file_handle, 0, ',' );
						unset( $header );
						$count          = 0;
						$import_options = array(
							'order_status'   => $order_status,
							'paypal_enable'  => $paypal_enable,
							'map_order_item' => $index['order_item_id'],
						);
						$orders         = array();
						$order_data     = array();
						$order_id       = '';
						$ftell_2        = 0;
						if ( $ftell > 0 ) {
							fseek( $file_handle, $ftell );
						} elseif ( $start > 1 ) {
							for ( $i = 0; $i < $start; $i ++ ) {
								$buff = fgetcsv( $file_handle, 0, ',' );
								unset( $buff );
							}
						}
						while ( ( $item = fgetcsv( $file_handle, 0, ',' ) ) !== false ) {
							$count ++;
							$order_id_1            = $item[ $index['order_id'] ];
							$mapped_order_status_1 = $index['order_status'] > - 1 ? $item[ $index['order_status'] ] : '';
							$tracking_number       = $item[ $index['tracking_number'] ];
							$carrier_slug          = $item[ $index['carrier_slug'] ];
							$order_item_id         = $index['order_item_id'] > - 1 ? $item[ $index['order_item_id'] ] : '';
							$start ++;
							$ftell_1 = ftell( $file_handle );
							if ( empty( $order_id_1 ) ) {
								$ftell_2 = $ftell_1;
								continue;
							}
							vi_wot_set_time_limit();
							if ( ! in_array( $order_id_1, $orders ) ) {
								/*Import previous order*/
								$this->import_tracking( $order_id, $order_data, $import_options, $changed_orders, $paypal, $ppec_paypal, $bulk_tracking_service_orders );
								if ( count( $orders ) < $orders_per_request ) {
									$order_id = $order_id_1;
									if ( $index['order_status'] > - 1 ) {
										$import_options['order_status'] = "wc-{$mapped_order_status_1}";
									}
									$orders[]   = $order_id;
									$order_data = array(
										array(
											'order_item_id'   => $order_item_id,
											'tracking_number' => $tracking_number,
											'carrier_slug'    => $carrier_slug,
										)
									);

								} else {
									fclose( $file_handle );
									wp_send_json( array(
										'status'               => 'success',
										'orders'               => $order_data,
										'start'                => $start - 1,
										'ftell'                => $ftell_2,
										'ftell_1'              => $ftell_1,
										'ftell_2'              => $ftell_2,
										'percent'              => intval( 100 * ( $start ) / $total ),
										'changed_orders'       => vi_wot_json_encode( $changed_orders ),
										'tracking_more_orders' => vi_wot_json_encode( $bulk_tracking_service_orders ),
										'paypal'               => vi_wot_json_encode( $paypal ),
										'ppec_paypal'          => vi_wot_json_encode( $ppec_paypal ),
									) );
								}
							} else {
								if ( $index['order_status'] > - 1 ) {
									$import_options['order_status'] = "wc-{$mapped_order_status_1}";
								}
								$order_data[] = array(
									'order_item_id'   => $index['order_item_id'] > - 1 ? $item[ $index['order_item_id'] ] : '',
									'tracking_number' => $tracking_number,
									'carrier_slug'    => $carrier_slug,
								);
							}
							unset( $item );
							$next_item = fgetcsv( $file_handle, 0, ',' );
							if ( false === $next_item ) {
								/*Import previous order*/
								$this->import_tracking( $order_id, $order_data, $import_options, $changed_orders, $paypal, $ppec_paypal, $bulk_tracking_service_orders );
								$this->bulk_add_tracking_numbers_last_items( $bulk_tracking_service_orders );
								fclose( $file_handle );
								self::wc_log( esc_html( 'Finish importing tracking') );

								if ( $paypal_enable ) {
									$paypal_total      = count( $paypal );
									$ppec_paypal_total = count( $ppec_paypal );
									if ( $paypal_total ) {
										self::wc_log( esc_html( 'Start adding tracking numbers to PayPal') );
										wp_send_json( array(
											'status'               => 'paypal',
											'start'                => $start,
											'percent'              => 0,
											'changed_orders'       => vi_wot_json_encode( $changed_orders ),
											'tracking_more_orders' => vi_wot_json_encode( $bulk_tracking_service_orders ),
											'paypal'               => vi_wot_json_encode( $paypal ),
											'paypal_total'         => ceil( $paypal_total / $paypal_transaction_per_request ),
											'ppec_paypal'          => vi_wot_json_encode( $ppec_paypal ),
											'ppec_paypal_total'    => ceil( $ppec_paypal_total / $paypal_transaction_per_request ),
										) );
									} elseif ( $ppec_paypal_total ) {
										self::wc_log( esc_html( 'Start adding tracking numbers to PayPal') );
										wp_send_json( array(
											'status'               => 'ppec_paypal',
											'start'                => $start,
											'percent'              => 0,
											'changed_orders'       => vi_wot_json_encode( $changed_orders ),
											'tracking_more_orders' => vi_wot_json_encode( $bulk_tracking_service_orders ),
											'paypal'               => vi_wot_json_encode( $paypal ),
											'paypal_total'         => ceil( $paypal_total / $paypal_transaction_per_request ),
											'ppec_paypal'          => vi_wot_json_encode( $ppec_paypal ),
											'ppec_paypal_total'    => ceil( $ppec_paypal_total / $paypal_transaction_per_request ),
										) );
									} elseif ( $email_enable && count( $changed_orders ) ) {
										self::wc_log( esc_html( 'Start scheduling to send emails') );
										wp_send_json( array(
											'status'               => 'send_email',
											'start'                => $start,
											'percent'              => 0,
											'changed_orders'       => vi_wot_json_encode( $changed_orders ),
											'tracking_more_orders' => vi_wot_json_encode( $bulk_tracking_service_orders ),
										) );
									} else {
										self::wc_log( esc_html( 'Import tracking from CSV completed' ) );
										wp_send_json( array(
											'status'               => 'finish',
											'message'              => esc_html__( 'Import completed', 'woocommerce-orders-tracking' ),
											'start'                => $start,
											'percent'              => intval( 100 * ( $start ) / $total ),
											'changed_orders'       => vi_wot_json_encode( $changed_orders ),
											'tracking_more_orders' => vi_wot_json_encode( $bulk_tracking_service_orders ),
										) );
									}

								} elseif ( $email_enable && count( $changed_orders ) ) {
									self::wc_log( esc_html( 'Start scheduling to send emails') );
									wp_send_json( array(
										'status'               => 'send_email',
										'start'                => $start,
										'percent'              => intval( 100 * ( $start ) / $total ),
										'changed_orders'       => vi_wot_json_encode( $changed_orders ),
										'tracking_more_orders' => vi_wot_json_encode( $bulk_tracking_service_orders ),
									) );
								} else {
									self::wc_log( esc_html( 'Import tracking from CSV completed' ) );
									wp_send_json( array(
										'status'               => 'finish',
										'message'              => esc_html__( 'Import completed', 'woocommerce-orders-tracking' ),
										'start'                => $start,
										'percent'              => intval( 100 * ( $start ) / $total ),
										'changed_orders'       => vi_wot_json_encode( $changed_orders ),
										'tracking_more_orders' => vi_wot_json_encode( $bulk_tracking_service_orders ),
									) );
								}
							} else {
								$count ++;
								$order_id_2            = $next_item[ $index['order_id'] ];
								$mapped_order_status_2 = $index['order_status'] > - 1 ? $next_item[ $index['order_status'] ] : '';
								$tracking_number       = $next_item[ $index['tracking_number'] ];
								$carrier_slug          = $next_item[ $index['carrier_slug'] ];
								$order_item_id         = $index['order_item_id'] > - 1 ? $next_item[ $index['order_item_id'] ] : '';
								$start ++;
								$ftell_2 = ftell( $file_handle );
								if ( empty( $order_id_2 ) ) {
									continue;
								}
								if ( ! in_array( $order_id_2, $orders ) ) {
									/*Import previous order*/
									$this->import_tracking( $order_id, $order_data, $import_options, $changed_orders, $paypal, $ppec_paypal, $bulk_tracking_service_orders );
									if ( count( $orders ) < $orders_per_request ) {
										$order_id = $order_id_2;
										if ( $index['order_status'] > - 1 ) {
											$import_options['order_status'] = "wc-{$mapped_order_status_2}";
										}
										$orders[]   = $order_id;
										$order_data = array(
											array(
												'order_item_id'   => $order_item_id,
												'tracking_number' => $tracking_number,
												'carrier_slug'    => $carrier_slug,
											)
										);
									} else {
										fclose( $file_handle );
										wp_send_json( array(
											'status'               => 'success',
											'orders'               => $order_data,
											'start'                => $start - 1,
											'ftell'                => $ftell_1,
											'ftell_2'              => $ftell_2,
											'ftell_1'              => $ftell_1,
											'percent'              => intval( 100 * ( $start ) / $total ),
											'changed_orders'       => vi_wot_json_encode( $changed_orders ),
											'tracking_more_orders' => vi_wot_json_encode( $bulk_tracking_service_orders ),
											'paypal'               => vi_wot_json_encode( $paypal ),
											'ppec_paypal'          => vi_wot_json_encode( $ppec_paypal ),
										) );
									}
								} else {
									if ( $index['order_status'] > - 1 ) {
										$import_options['order_status'] = "wc-{$mapped_order_status_2}";
									}
									$order_data[] = array(
										'order_item_id'   => $index['order_item_id'] > - 1 ? $next_item[ $index['order_item_id'] ] : '',
										'tracking_number' => $tracking_number,
										'carrier_slug'    => $carrier_slug,
									);
								}
								unset( $next_item );
							}
						}
						$this->import_tracking( $order_id, $order_data, $import_options, $changed_orders, $paypal, $ppec_paypal, $bulk_tracking_service_orders );
						$this->bulk_add_tracking_numbers_last_items( $bulk_tracking_service_orders );
						fclose( $file_handle );
						self::wc_log( esc_html( 'Finish importing tracking') );

						if ( $paypal_enable ) {
							$paypal_total      = count( $paypal );
							$ppec_paypal_total = count( $ppec_paypal );
							if ( $paypal_total ) {
								self::wc_log( esc_html( 'Start adding tracking numbers to PayPal' ) );
								wp_send_json( array(
									'status'               => 'paypal',
									'start'                => $start,
									'percent'              => 0,
									'changed_orders'       => vi_wot_json_encode( $changed_orders ),
									'tracking_more_orders' => vi_wot_json_encode( $bulk_tracking_service_orders ),
									'paypal'               => vi_wot_json_encode( $paypal ),
									'paypal_total'         => $paypal_total,
									'ppec_paypal'          => vi_wot_json_encode( $ppec_paypal ),
									'ppec_paypal_total'    => ceil( $ppec_paypal_total / $paypal_transaction_per_request ),
								) );
							} elseif ( $ppec_paypal_total ) {
								self::wc_log( esc_html( 'Start adding tracking numbers to PayPal' ) );
								wp_send_json( array(
									'status'               => 'ppec_paypal',
									'start'                => $start,
									'percent'              => 0,
									'changed_orders'       => vi_wot_json_encode( $changed_orders ),
									'tracking_more_orders' => vi_wot_json_encode( $bulk_tracking_service_orders ),
									'paypal'               => vi_wot_json_encode( $paypal ),
									'paypal_total'         => $paypal_total,
									'ppec_paypal'          => vi_wot_json_encode( $ppec_paypal ),
									'ppec_paypal_total'    => ceil( $ppec_paypal_total / $paypal_transaction_per_request ),
								) );
							} elseif ( $email_enable && count( $changed_orders ) ) {
								self::wc_log( esc_html( 'Start scheduling to send emails' ) );
								wp_send_json( array(
									'status'               => 'send_email',
									'start'                => $start,
									'percent'              => 0,
									'changed_orders'       => vi_wot_json_encode( $changed_orders ),
									'tracking_more_orders' => vi_wot_json_encode( $bulk_tracking_service_orders ),
								) );
							} else {
								self::wc_log( esc_html( 'Import tracking from CSV completed' ) );
								wp_send_json( array(
									'status'               => 'finish',
									'message'              => esc_html__( 'Import completed', 'woocommerce-orders-tracking' ),
									'start'                => $start,
									'percent'              => intval( 100 * ( $start ) / $total ),
									'changed_orders'       => vi_wot_json_encode( $changed_orders ),
									'tracking_more_orders' => vi_wot_json_encode( $bulk_tracking_service_orders ),
								) );
							}

						} elseif ( $email_enable && count( $changed_orders ) ) {
							self::wc_log( esc_html( 'Start scheduling to send emails') );
							wp_send_json( array(
								'status'               => 'send_email',
								'start'                => $start,
								'percent'              => intval( 100 * ( $start ) / $total ),
								'changed_orders'       => vi_wot_json_encode( $changed_orders ),
								'tracking_more_orders' => vi_wot_json_encode( $bulk_tracking_service_orders ),
							) );
						} else {
							self::wc_log( esc_html( 'Import tracking from CSV completed' ) );
							wp_send_json( array(
								'status'               => 'finish',
								'message'              => esc_html__( 'Import completed', 'woocommerce-orders-tracking' ),
								'start'                => $start,
								'percent'              => intval( 100 * ( $start ) / $total ),
								'changed_orders'       => vi_wot_json_encode( $changed_orders ),
								'tracking_more_orders' => vi_wot_json_encode( $bulk_tracking_service_orders ),
							) );
						}

					} else {
						wp_send_json(
							array(
								'status'  => 'error',
								'message' => esc_html__( 'Invalid file.', 'woocommerce-orders-tracking' ),
							)
						);
					}
				} else {
					wp_send_json(
						array(
							'status'  => 'error',
							'message' => esc_html__( 'Invalid file.', 'woocommerce-orders-tracking' ),
						)
					);
				}

				break;
			case 'paypal':
				$paypal_total          = isset( $_POST['paypal_total'] ) ? absint( $_POST['paypal_total'] ) : 0;
				$paypal_processed      = isset( $_POST['paypal_processed'] ) ? absint( $_POST['paypal_processed'] ) : 0;
				$ppec_paypal_total     = isset( $_POST['ppec_paypal_total'] ) ? absint( $_POST['ppec_paypal_total'] ) : 0;
				$ppec_paypal_processed = isset( $_POST['ppec_paypal_processed'] ) ? absint( $_POST['ppec_paypal_processed'] ) : 0;
				$send_paypal           = array();
				/*test*/
				$paypal_method = $paypal[0]['method_id'];
				foreach ( $paypal as $paypal_k => $paypal_item ) {
					if ( $paypal_item['method_id'] === $paypal_method ) {
						$send_paypal[] = $paypal_item;
						unset( $paypal[ $paypal_k ] );
					}
					if ( count( $send_paypal ) >= 20 ) {
						break;
					}
				}
				$credentials = VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_PAYPAL::get_api_credentials( $paypal_method );
				if ( $credentials['id'] && $credentials['secret'] ) {
					$add_paypal = VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_PAYPAL::add_tracking_number( $credentials['id'], $credentials['secret'], $send_paypal,
						$credentials['sandbox'] );
				} else {
					$add_paypal = array(
						'status' => 'error',
						'data'   => esc_html__( 'PayPal payment method not supported or missing API credentials', 'woocommerce-orders-tracking' )
					);
				}

//				$send_paypal       = array_splice( $paypal, 0, $paypal_transaction_per_request );
				$count_send_paypal = count( $send_paypal );
				$paypal_processed  += $count_send_paypal;
//				$add_paypal        = $this->add_trackinfo_to_paypal( $send_paypal, 'paypal' );
				$logs = '';
				$i    = 0;
				if ( $add_paypal['status'] === 'error' ) {
					if ( isset( $add_paypal['errors'] ) && is_array( $add_paypal['errors'] ) && count( $add_paypal['errors'] ) ) {
						foreach ( $send_paypal as $send_paypal_item ) {
							$i ++;
							$order_id          = $send_paypal_item['order_id'];
							$error_description = $add_paypal['data'];
							foreach ( $add_paypal['errors'] as $error ) {
								if ( is_array( $error['details'] ) && count( $error['details'] ) ) {
									if ( ! empty( $error['details'][0]['value'] ) && $send_paypal_item['tracking_number'] == $error['details'][0]['value'] ) {
										if ( ! empty( $error['details'][0]['description'] ) ) {
											$error_description = $error['details'][0]['description'];
										}
										break;
									}
								}
							}
							$logs .= esc_html( "Error adding tracking number {$send_paypal_item['tracking_number']} to PayPal for order #{$order_id}. Error message: {$error_description}" );
							if ( $i < $count_send_paypal ) {
								$logs .= PHP_EOL;
							}
						}
					} else {
						foreach ( $send_paypal as $send_paypal_item ) {
							$i ++;
							$order_id = $send_paypal_item['order_id'];
							$logs     .= esc_html( "Error adding tracking number {$send_paypal_item['tracking_number']} to PayPal for order #{$order_id}. Error message: {$add_paypal['data']}");
							if ( $i < $count_send_paypal ) {
								$logs .= PHP_EOL;
							}
						}
					}
				} else {
					foreach ( $send_paypal as $send_paypal_item ) {
						$i ++;
						$order_id               = $send_paypal_item['order_id'];
						$order_tmp              = wc_get_order( $order_id );
						$paypal_added_trackings = $order_tmp->get_meta( 'vi_wot_paypal_added_tracking_numbers', true );
						if ( ! $paypal_added_trackings ) {
							$paypal_added_trackings = array();
						}
						if ( ! in_array( $send_paypal_item['tracking_number'], $paypal_added_trackings ) ) {
							$logs .= esc_html( "Add tracking number {$send_paypal_item['tracking_number']} to PayPal for order #{$order_id} successfully." );
							if ( $i < $count_send_paypal ) {
								$logs .= PHP_EOL;
							}
							$paypal_added_trackings[] = $send_paypal_item['tracking_number'];
							$order_tmp->update_meta_data( 'vi_wot_paypal_added_tracking_numbers', $paypal_added_trackings );
							$order_tmp->save_meta_data();
						}
					}
				}
				if ( $logs ) {
					self::wc_log( $logs );
				}
				if ( count( $paypal ) ) {
					$paypal = array_values( $paypal );
					wp_send_json( array(
						'status'               => 'paypal',
						'percent'              => intval( 100 * ( $paypal_processed ) / $paypal_total ),
						'changed_orders'       => vi_wot_json_encode( $changed_orders ),
						'tracking_more_orders' => vi_wot_json_encode( $bulk_tracking_service_orders ),
						'paypal'               => vi_wot_json_encode( $paypal ),
						'paypal_total'         => $paypal_total,
						'paypal_processed'     => $paypal_processed,
						'ppec_paypal'          => vi_wot_json_encode( $ppec_paypal ),
					) );
				} elseif ( $ppec_paypal_total ) {
					wp_send_json( array(
						'status'                => 'ppec_paypal',
						'percent'               => 0,
						'changed_orders'        => vi_wot_json_encode( $changed_orders ),
						'tracking_more_orders'  => vi_wot_json_encode( $bulk_tracking_service_orders ),
						'ppec_paypal'           => vi_wot_json_encode( $ppec_paypal ),
						'ppec_paypal_total'     => $ppec_paypal_total,
						'ppec_paypal_processed' => $ppec_paypal_processed,
					) );
				} elseif ( $email_enable && count( $changed_orders ) ) {
					self::wc_log( esc_html( 'Start scheduling to send emails' ) );
					wp_send_json( array(
						'status'               => 'send_email',
						'start'                => $start,
						'percent'              => 0,
						'changed_orders'       => vi_wot_json_encode( $changed_orders ),
						'tracking_more_orders' => vi_wot_json_encode( $bulk_tracking_service_orders ),
					) );
				} else {
					self::wc_log( esc_html( 'Import tracking from CSV completed') );
					wp_send_json( array(
						'status'               => 'finish',
						'message'              => esc_html__( 'Import completed', 'woocommerce-orders-tracking' ),
						'start'                => $start,
						'percent'              => 0,
						'changed_orders'       => vi_wot_json_encode( $changed_orders ),
						'tracking_more_orders' => vi_wot_json_encode( $bulk_tracking_service_orders ),
					) );
				}

				break;
			case 'ppec_paypal':
				$ppec_paypal_total     = isset( $_POST['ppec_paypal_total'] ) ? absint( $_POST['ppec_paypal_total'] ) : 0;
				$ppec_paypal_processed = isset( $_POST['ppec_paypal_processed'] ) ? absint( $_POST['ppec_paypal_processed'] ) : 0;
				$send_paypal           = array_splice( $ppec_paypal, 0, $paypal_transaction_per_request );
				$count_send_paypal     = count( $send_paypal );
				$ppec_paypal_processed += $count_send_paypal;
				$add_paypal            = $this->add_trackinfo_to_paypal( $send_paypal, 'ppec_paypal' );
				$logs                  = '';
				$i                     = 0;
				if ( $add_paypal['status'] === 'error' ) {
					if ( isset( $add_paypal['errors'] ) && is_array( $add_paypal['errors'] ) && count( $add_paypal['errors'] ) ) {
						foreach ( $send_paypal as $send_paypal_item ) {
							$i ++;
							$order_id          = $send_paypal_item['order_id'];
							$error_description = $add_paypal['data'];
							foreach ( $add_paypal['errors'] as $error ) {
								if ( is_array( $error['details'] ) && count( $error['details'] ) ) {
									if ( ! empty( $error['details'][0]['value'] ) && $send_paypal_item['tracking_number'] == $error['details'][0]['value'] ) {
										if ( ! empty( $error['details'][0]['description'] ) ) {
											$error_description = $error['details'][0]['description'];
										}
										break;
									}
								}
							}
							$logs .= esc_html( "Error adding tracking number {$send_paypal_item['tracking_number']} to PayPal for order #{$order_id}. Error message: {$error_description}");
							if ( $i < $count_send_paypal ) {
								$logs .= PHP_EOL;
							}
						}
					} else {
						foreach ( $send_paypal as $send_paypal_item ) {
							$i ++;
							$order_id = $send_paypal_item['order_id'];
							$logs     .= esc_html( "Error adding tracking number {$send_paypal_item['tracking_number']} to PayPal for order #{$order_id}. Error message: {$add_paypal['data']}");
							if ( $i < $count_send_paypal ) {
								$logs .= PHP_EOL;
							}
						}
					}
				} else {
					foreach ( $send_paypal as $send_paypal_item ) {
						$i ++;
						$order_id               = $send_paypal_item['order_id'];
						$order_t                = wc_get_order( $order_id );
						$paypal_added_trackings = $order_t->get_meta( 'vi_wot_paypal_added_tracking_numbers', true );
						if ( ! $paypal_added_trackings ) {
							$paypal_added_trackings = array();
						}
						if ( ! in_array( $send_paypal_item['tracking_number'], $paypal_added_trackings ) ) {
							$logs .= esc_html( "Add tracking number {$send_paypal_item['tracking_number']} to PayPal for order #{$order_id} successfully." );
							if ( $i < $count_send_paypal ) {
								$logs .= PHP_EOL;
							}
							$paypal_added_trackings[] = $send_paypal_item['tracking_number'];
							$order_t->update_meta_data( 'vi_wot_paypal_added_tracking_numbers', $paypal_added_trackings );
							$order_t->save_meta_data();
						}
					}
				}
				if ( $logs ) {
					self::wc_log( $logs );
				}
				if ( count( $ppec_paypal ) ) {
					wp_send_json( array(
						'status'                => 'ppec_paypal',
						'percent'               => intval( 100 * ( $ppec_paypal_processed ) / $ppec_paypal_total ),
						'changed_orders'        => vi_wot_json_encode( $changed_orders ),
						'tracking_more_orders'  => vi_wot_json_encode( $bulk_tracking_service_orders ),
						'ppec_paypal'           => vi_wot_json_encode( $ppec_paypal ),
						'ppec_paypal_total'     => $ppec_paypal_total,
						'ppec_paypal_processed' => $ppec_paypal_processed,
					) );
				} elseif ( $email_enable && count( $changed_orders ) ) {
					self::wc_log( esc_html( 'Start scheduling to send emails') );
					wp_send_json( array(
						'status'               => 'send_email',
						'start'                => $start,
						'percent'              => 0,
						'changed_orders'       => vi_wot_json_encode( $changed_orders ),
						'tracking_more_orders' => vi_wot_json_encode( $bulk_tracking_service_orders ),
					) );
				} else {
					self::wc_log( esc_html( 'Import tracking from CSV completed' ) );
					wp_send_json( array(
						'status'               => 'finish',
						'message'              => esc_html__( 'Import completed', 'woocommerce-orders-tracking' ),
						'start'                => $start,
						'percent'              => 0,
						'changed_orders'       => vi_wot_json_encode( $changed_orders ),
						'tracking_more_orders' => vi_wot_json_encode( $bulk_tracking_service_orders ),
					) );
				}
				break;
			case 'send_email':
				$orders = get_option( 'vi_wot_send_mails_for_import_csv_function_orders' );
				if ( $orders ) {
					$orders = vi_wot_json_decode( $orders );
				} else {
					$orders = array();
				}
				$orders   = array_unique( array_merge( $orders, $changed_orders ) );
				$schedule = wp_next_scheduled( 'vi_wot_send_mails_for_import_csv_function' );
				if ( $schedule !== false ) {
					update_option( 'vi_wot_send_mails_for_import_csv_function_orders', vi_wot_json_encode( $orders ) );
				} else {
					$email_number_send = absint( self::$settings->get_params( 'email_number_send' ) );
					if ( ! $email_number_send ) {
						$email_number_send = 1;
					}
					$send_now = array_splice( $orders, 0, $email_number_send );
					update_option( 'vi_wot_send_mails_for_import_csv_function_orders', vi_wot_json_encode( $orders ) );
					foreach ( $send_now as $order_id ) {
						self::send_mail( $order_id );
					}
					if ( count( $orders ) ) {
						$email_time_send      = absint( self::$settings->get_params( 'email_time_send' ) );
						$email_time_send_type = self::$settings->get_params( 'email_time_send_type' );
						switch ( $email_time_send_type ) {
							case 'day':
								$email_time_send = DAY_IN_SECONDS * $email_time_send;
								break;
							case 'hour':
								$email_time_send = HOUR_IN_SECONDS * $email_time_send;
								break;
							case 'minute':
								$email_time_send = MINUTE_IN_SECONDS * $email_time_send;
								break;
							default:
						}
						wp_schedule_single_event( time() + $email_time_send, 'vi_wot_send_mails_for_import_csv_function' );
					}
				}
				self::wc_log( esc_html( 'Import tracking from CSV completed') );
				wp_send_json( array(
					'status'               => 'finish',
					'message'              => esc_html__( 'Import completed', 'woocommerce-orders-tracking' ),
					'start'                => $start,
					'percent'              => 0,
					'changed_orders'       => vi_wot_json_encode( $changed_orders ),
					'tracking_more_orders' => vi_wot_json_encode( $bulk_tracking_service_orders ),
				) );
				break;
			default:
				wp_send_json( array(
					'status'               => 'error',
					'message'              => esc_html__( 'Invalid data.', 'woocommerce-orders-tracking' ),
					'start'                => $start,
					'percent'              => 0,
					'changed_orders'       => vi_wot_json_encode( $changed_orders ),
					'tracking_more_orders' => vi_wot_json_encode( $bulk_tracking_service_orders ),
				) );
		}
	}

	/**Schedule function to handle emails after importing tracking
	 *
	 * @throws Exception
	 */
	public function send_mails_for_import_csv_function() {
		$orders = get_option( 'vi_wot_send_mails_for_import_csv_function_orders' );
		if ( $orders ) {
			$orders            = vi_wot_json_decode( $orders );
			$email_number_send = absint( self::$settings->get_params( 'email_number_send' ) );
			if ( ! $email_number_send ) {
				$email_number_send = 1;
			}
			$send_now = array_splice( $orders, 0, $email_number_send );
			update_option( 'vi_wot_send_mails_for_import_csv_function_orders', vi_wot_json_encode( $orders ) );
			foreach ( $send_now as $order_id ) {
				self::send_mail( $order_id );
			}
			if ( count( $orders ) ) {
				$email_time_send      = absint( self::$settings->get_params( 'email_time_send' ) );
				$email_time_send_type = self::$settings->get_params( 'email_time_send_type' );
				switch ( $email_time_send_type ) {
					case 'day':
						$email_time_send = DAY_IN_SECONDS * $email_time_send;
						break;
					case 'hour':
						$email_time_send = HOUR_IN_SECONDS * $email_time_send;
						break;
					case 'minute':
						$email_time_send = MINUTE_IN_SECONDS * $email_time_send;
						break;
					default:
				}
				wp_schedule_single_event( time() + $email_time_send, 'vi_wot_send_mails_for_import_csv_function' );
			}
		}
	}

	/**
	 * @param $send_mail
	 *
	 * @throws Exception
	 */
	public function vi_wot_send_mail_tracking_code( $send_mail ) {
		if ( $total_send_mail = count( $send_mail ) ) {
			$send_mail = array_values( $send_mail );
			$total     = self::$settings->get_params( 'email_number_send' );
			if ( $total_send_mail > $total ) {
				for ( $i = 0; $i < $total; $i ++ ) {
					$order_id = $send_mail[ $i ]['order_id'];
					$imported = $send_mail[ $i ]['imported'];
					if ( count( $imported ) ) {
						self::send_mail( $order_id, $imported );
					}
				}
				$length = ( $total > 1 ) ? $total - 1 : 1;
				array_splice( $send_mail, 0, $length );
				if ( ! empty( $send_mail ) ) {
					$time = (int) self::$settings->get_params( 'email_time_send' );
					switch ( self::$settings->get_params( 'email_time_send_type' ) ) {
						case 'day':
							$time_type = DAY_IN_SECONDS * $time;
							break;
						case 'hour':
							$time_type = HOUR_IN_SECONDS * $time;
							break;
						case 'minute':
							$time_type = MINUTE_IN_SECONDS * $time;
							break;
						default:
							$time_type = HOUR_IN_SECONDS * $time;
					}
					wp_schedule_single_event( time() + $time_type, 'vi_wot_send_mail_tracking_code', array( $send_mail ) );
				}
			} else {
				for ( $i = 0; $i < $total_send_mail; $i ++ ) {
					$order_id = $send_mail[ $i ]['order_id'];
					$imported = $send_mail[ $i ]['imported'];
					if ( count( $imported ) ) {
						self::send_mail( $order_id, $imported );
					}
				}
			}
		}
	}

	/**Add tracking to PayPal
	 *
	 * @param $send_paypal
	 * @param $paypal_method
	 *
	 * @return array
	 */
	public function add_trackinfo_to_paypal( $send_paypal, $paypal_method ) {
		$available_paypal_method = self::$settings->get_params( 'paypal_method' );
		$i                       = array_search( $paypal_method, $available_paypal_method );
		if ( is_numeric( $i ) ) {
			$sandbox = self::$settings->get_params( 'paypal_sandbox_enable' )[ $i ] ? true : false;
			if ( $sandbox ) {
				$client_id = self::$settings->get_params( 'paypal_client_id_sandbox' )[ $i ];
				$secret    = self::$settings->get_params( 'paypal_secret_sandbox' )[ $i ];
			} else {
				$client_id = self::$settings->get_params( 'paypal_client_id_live' )[ $i ];
				$secret    = self::$settings->get_params( 'paypal_secret_live' )[ $i ];
			}
			$result = VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_PAYPAL::add_tracking_number( $client_id, $secret, $send_paypal, $sandbox );

		} else {
			$result = array(
				'status' => 'error',
				'data'   => esc_html__( 'PayPal method not found', 'woocommerce-orders-tracking' )
			);
		}

		return $result;
	}

	public function admin_enqueue_scripts() {
		global $pagenow;
		$page = isset( $_REQUEST['page'] ) ? sanitize_text_field( $_REQUEST['page'] ) : '';
		if ( $pagenow === 'admin.php' && $page === 'woo-orders-tracking-import-csv' ) {
			global $wp_scripts;
			$scripts = $wp_scripts->registered;
			foreach ( $scripts as $k => $script ) {
				preg_match( '/select2/i', $k, $result );
				if ( count( array_filter( $result ) ) ) {
					unset( $wp_scripts->registered[ $k ] );
					wp_dequeue_script( $script->handle );
				}
				preg_match( '/bootstrap/i', $k, $result );
				if ( count( array_filter( $result ) ) ) {
					unset( $wp_scripts->registered[ $k ] );
					wp_dequeue_script( $script->handle );
				}
			}
			wp_dequeue_script( 'select-js' );//Causes select2 error, from ThemeHunk MegaMenu Plus plugin
			wp_dequeue_style( 'eopa-admin-css' );
			wp_enqueue_script( 'semantic-ui-form', VI_WOOCOMMERCE_ORDERS_TRACKING_JS . 'form.min.js', array( 'jquery' ) , VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION, false );
			wp_enqueue_style( 'semantic-ui-form', VI_WOOCOMMERCE_ORDERS_TRACKING_CSS . 'form.min.css', '', VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION );
			wp_enqueue_script( 'semantic-ui-progress', VI_WOOCOMMERCE_ORDERS_TRACKING_JS . 'progress.min.js', array( 'jquery' ), VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION, false  );
			wp_enqueue_style( 'semantic-ui-progress', VI_WOOCOMMERCE_ORDERS_TRACKING_CSS . 'progress.min.css', '', VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION );
			wp_enqueue_script( 'semantic-ui-checkbox', VI_WOOCOMMERCE_ORDERS_TRACKING_JS . 'checkbox.min.js', array( 'jquery' ), VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION, false  );
			wp_enqueue_style( 'semantic-ui-checkbox', VI_WOOCOMMERCE_ORDERS_TRACKING_CSS . 'checkbox.min.css', '', VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION );
			wp_enqueue_style( 'semantic-ui-input', VI_WOOCOMMERCE_ORDERS_TRACKING_CSS . 'input.min.css', '', VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION );
			wp_enqueue_style( 'semantic-ui-table', VI_WOOCOMMERCE_ORDERS_TRACKING_CSS . 'table.min.css', '', VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION );
			wp_enqueue_style( 'semantic-ui-segment', VI_WOOCOMMERCE_ORDERS_TRACKING_CSS . 'segment.min.css', '', VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION );
			wp_enqueue_style( 'semantic-ui-label', VI_WOOCOMMERCE_ORDERS_TRACKING_CSS . 'label.min.css', '', VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION );
			wp_enqueue_style( 'semantic-ui-menu', VI_WOOCOMMERCE_ORDERS_TRACKING_CSS . 'menu.min.css', '', VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION );
			wp_enqueue_style( 'semantic-ui-button', VI_WOOCOMMERCE_ORDERS_TRACKING_CSS . 'button.min.css', '', VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION );
			wp_enqueue_style( 'semantic-ui-dropdown', VI_WOOCOMMERCE_ORDERS_TRACKING_CSS . 'dropdown.min.css' , '', VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION);
			wp_enqueue_style( 'semantic-ui-message', VI_WOOCOMMERCE_ORDERS_TRACKING_CSS . 'message.min.css', '', VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION );
			wp_enqueue_style( 'semantic-ui-icon', VI_WOOCOMMERCE_ORDERS_TRACKING_CSS . 'icon.min.css', '', VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION );
			if ( ! wp_script_is( 'select2' ) ) {
				wp_enqueue_script( 'select2', VI_WOOCOMMERCE_ORDERS_TRACKING_JS . 'select2.js', array( 'jquery' ), '4.0.3', false );
				wp_enqueue_style( 'select2', VI_WOOCOMMERCE_ORDERS_TRACKING_CSS . 'select2.min.css', '', VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION );
			}
			wp_enqueue_style( 'semantic-ui-step', VI_WOOCOMMERCE_ORDERS_TRACKING_CSS . 'step.min.css', '', VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION );
			/*Color picker*/
			wp_enqueue_style( 'wp-color-picker' );
			wp_enqueue_script( 'wp-color-picker' );
			wp_enqueue_script(
				'iris', admin_url( 'js/iris.min.js' ), array(
				'jquery-ui-draggable',
				'jquery-ui-slider',
				'jquery-touch-punch'
			), VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION, true );
			if ( ! wp_script_is( 'transition' ) ) {
				wp_enqueue_style( 'transition', VI_WOOCOMMERCE_ORDERS_TRACKING_CSS . 'transition.min.css', '', VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION );
				wp_enqueue_script( 'transition', VI_WOOCOMMERCE_ORDERS_TRACKING_JS . 'transition.min.js', array( 'jquery' ), VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION, false );
			}
			wp_enqueue_script( 'woo-orders-tracking-dropdown', VI_WOOCOMMERCE_ORDERS_TRACKING_JS . 'dropdown.min.js', array( 'jquery' ), VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION, false );
			wp_enqueue_script( 'woo-orders-tracking-import', VI_WOOCOMMERCE_ORDERS_TRACKING_JS . 'import-csv.js', array( 'jquery' ), VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION, false );
			wp_enqueue_style( 'woo-orders-tracking-import', VI_WOOCOMMERCE_ORDERS_TRACKING_CSS . 'import-csv.css', '', VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION );
			wp_localize_script( 'woo-orders-tracking-import', 'woo_orders_tracking_import_params', array(
				'url'                   => admin_url( 'admin-ajax.php' ),
				'step'                  => $this->step,
				'nonce'                 => $this->nonce,
				'vi_wot_index'          => $this->index,
				'orders_per_request'    => isset( $_POST['woo_orders_tracking_orders_per_request'] )
					? absint( sanitize_text_field( $_POST['woo_orders_tracking_orders_per_request'] ) ) : '1',
				'custom_start'          => isset( $_POST['woo_orders_tracking_custom_start'] ) ? sanitize_text_field( $_POST['woo_orders_tracking_custom_start'] ) : 1,
				'email_enable'          => isset( $_POST['woo_orders_tracking_email_enable'] ) ? sanitize_text_field( $_POST['woo_orders_tracking_email_enable'] ) : '',
				'paypal_enable'         => isset( $_POST['woo_orders_tracking_paypal_enable'] ) ? sanitize_text_field( $_POST['woo_orders_tracking_paypal_enable'] ) : '',
				'order_status'          => isset( $_POST['woo_orders_tracking_order_status'] ) ? sanitize_text_field( $_POST['woo_orders_tracking_order_status'] ) : '',
				'required_fields'       => array(
					'order_id'        => esc_html__( 'Order ID', 'woocommerce-orders-tracking' ),
					'tracking_number' => esc_html__( 'Tracking Number', 'woocommerce-orders-tracking' ),
					'carrier_slug'    => esc_html__( 'Carrier Slug', 'woocommerce-orders-tracking' ),
				),
				'i18n_required_field'   => esc_html__( '%s is required to map', 'woocommerce-orders-tracking' ),// phpcs:ignore WordPress.WP.I18n.MissingTranslatorsComment
				'i18n_required_fields'  => esc_html__( 'These fields are required to map: %s', 'woocommerce-orders-tracking' ),// phpcs:ignore WordPress.WP.I18n.MissingTranslatorsComment
				'i18n_import_completed' => esc_html__( 'Import completed. Please go to Orders Tracking/Logs to view import log.', 'woocommerce-orders-tracking' ),
			) );
		}
	}

	/**
	 * Import csv UI
	 */
	public function import_csv_callback() {
		?>
        <div class="wrap">
            <h2><?php esc_html_e( 'Import Tracking From CSV file', 'woocommerce-orders-tracking' ); ?></h2>
			<?php
			$steps_state = array(
				'start'   => '',
				'mapping' => '',
				'import'  => '',
			);
			if ( $this->step === 'mapping' ) {
				$steps_state['start']   = '';
				$steps_state['mapping'] = 'active';
				$steps_state['import']  = 'disabled';
			} elseif ( $this->step === 'import' ) {
				$steps_state['start']   = '';
				$steps_state['mapping'] = '';
				$steps_state['import']  = 'active';
			} else {
				$steps_state['start']   = 'active';
				$steps_state['mapping'] = 'disabled';
				$steps_state['import']  = 'disabled';
			}
			?>
            <div class="vi-ui segment">
                <div class="vi-ui steps fluid">
                    <div class="step <?php echo esc_attr( $steps_state['start'] ) ?>">
                        <i class="upload icon"></i>
                        <div class="content">
                            <div class="title"><?php esc_html_e( 'Select file', 'woocommerce-orders-tracking' ); ?></div>
                        </div>
                    </div>
                    <div class="step <?php echo esc_attr( $steps_state['mapping'] ) ?>">
                        <i class="exchange icon"></i>
                        <div class="content">
                            <div class="title"><?php esc_html_e( 'Settings & Mapping', 'woocommerce-orders-tracking' ); ?></div>
                        </div>
                    </div>
                    <div class="step <?php echo esc_attr( $steps_state['import'] ) ?>">
                        <i class="refresh icon <?php echo esc_attr( self::set( 'import-icon' ) ) ?>"></i>
                        <div class="content">
                            <div class="title"><?php esc_html_e( 'Import', 'woocommerce-orders-tracking' ); ?></div>
                        </div>
                    </div>
                </div>
				<?php
				if ( isset( $_REQUEST['vi_wot_error'] ) ) {
					$file_url = $this->file_url;
					?>
                    <div class="vi-ui negative message">
                        <div class="header">
							<?php
							switch ( $_REQUEST['vi_wot_error'] ) {
								case 1:
									esc_html_e( 'Please set mapping for all required fields', 'woocommerce-orders-tracking' );
									break;
								case 2:
									if ( $file_url ) {
										echo wp_kses_post(sprintf( __( "Can not open file: <strong>%s</strong>", 'woocommerce-orders-tracking' ), $file_url) );// phpcs:ignore WordPress.WP.I18n.MissingTranslatorsComment
									} else {
										esc_html_e( 'Can not open file', 'woocommerce-orders-tracking' );
									}
									break;
								default:
									if ( $file_url ) {
										echo wp_kses_post(sprintf( __( "File not exists: <strong>%s</strong>", 'woocommerce-orders-tracking' ), $file_url) );// phpcs:ignore WordPress.WP.I18n.MissingTranslatorsComment
									} else {
										esc_html_e( 'File not exists', 'woocommerce-orders-tracking' );
									}
							}
							?>
                        </div>
                    </div>
					<?php
				}
				if ( $this->error ) {
					?>
                    <div class="vi-ui negative message">
                        <div class="header">
							<?php echo esc_html( $this->error ) ?>
                        </div>
                    </div>
					<?php
				}
				switch ( $this->step ) {
					case 'mapping':
						?>
                        <form class="<?php echo esc_attr( self::set( 'import-container-form' ) ) ?> vi-ui form"
                              method="post"
                              enctype="multipart/form-data"
                              action="<?php echo esc_attr( remove_query_arg( array(
							      'step',
							      'vi_wot_error'
						      ) ) ) ?>">
							<?php
							wp_nonce_field( 'woo_orders_tracking_import_action_nonce', '_woo_orders_tracking_import_nonce' );

							?>

                            <div class="vi-ui segment">
                                <table class="form-table">
                                    <tbody>
                                    <tr>
                                        <th>
                                            <label for="<?php echo esc_attr( self::set( 'orders_per_request' ) ) ?>"><?php esc_html_e( 'Orders per step',
													'woocommerce-orders-tracking' ); ?></label>
                                        </th>
                                        <td>
                                            <input type="number"
                                                   class="<?php echo esc_attr( self::set( 'orders_per_request' ) ) ?>"
                                                   id="<?php echo esc_attr( self::set( 'orders_per_request' ) ) ?>"
                                                   name="<?php echo esc_attr( self::set( 'orders_per_request', true ) ) ?>"
                                                   min="1"
                                                   value="<?php echo esc_attr( self::$settings->get_params( 'orders_per_request' ) ) ?>">
                                        </td>
                                    </tr>
                                    <tr>
                                        <th>
                                            <label for="<?php echo esc_attr( self::set( 'custom_start' ) ) ?>"><?php esc_html_e( 'Start at row',
													'woocommerce-orders-tracking' ); ?></label>
                                        </th>
                                        <td>
                                            <input type="number"
                                                   class="<?php echo esc_attr( self::set( 'custom_start' ) ) ?>"
                                                   id="<?php echo esc_attr( self::set( 'custom_start' ) ) ?>"
                                                   name="<?php echo esc_attr( self::set( 'custom_start', true ) ) ?>"
                                                   min="2"
                                                   value="2">
                                            <p class="description"><?php esc_html_e( 'Only import tracking from this row on.', 'woocommerce-orders-tracking' ) ?></p>
                                        </td>
                                    </tr>
                                    <tr>
                                        <th>
                                            <label for="<?php echo esc_attr( self::set( 'setting-email-enable' ) ) ?>">
												<?php
												esc_html_e( 'Send email', 'woocommerce-orders-tracking' );
												?>
                                            </label>
                                        </th>
                                        <td>
                                            <div class="vi-ui toggle checkbox">
                                                <input type="checkbox"
                                                       class="<?php echo esc_attr( self::set( 'email_enable' ) ) ?>"
                                                       id="<?php echo esc_attr( self::set( 'email_enable' ) ) ?>"
                                                       name="<?php echo esc_attr( self::set( 'email_enable', true ) ) ?>"
                                                       value="1" <?php checked( self::$settings->get_params( 'email_enable' ), '1' ) ?>>
                                                <label></label>
                                            </div>
                                            <p class="description"><?php esc_html_e( 'Send email to customers when their orders\' tracking numbers are updated',
													'woocommerce-orders-tracking' ) ?>
                                                <a target="_blank"
                                                   href="<?php echo esc_url( admin_url( 'admin.php?page=woocommerce-orders-tracking#email' ) ) ?>"><?php esc_html_e( 'View settings',
														'woocommerce-orders-tracking' ) ?></a>
                                            </p>
                                        </td>
                                    </tr>
									<?php
									$available_gateways        = WC()->payment_gateways()->payment_gateways();
									$supported_paypal_gateways = VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_PAYPAL::get_supported_paypal_gateways();
									$paypal_enable             = false;
									foreach ( $supported_paypal_gateways as $gateway ) {
										if ( array_key_exists( $gateway, $available_gateways ) ) {
											$credentials = VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_PAYPAL::get_api_credentials( $gateway );
											if ( $credentials['id'] && $credentials['secret'] ) {
												$paypal_enable = true;
												break;
											}
										}
									}
									?>
                                    <tr>
                                        <th>
                                            <label for="<?php echo esc_attr( self::set( 'paypal_enable' ) ) ?>">
												<?php
												esc_html_e( 'Add to PayPal', 'woocommerce-orders-tracking' );
												?>
                                            </label>
                                        </th>
                                        <td>
											<?php
											if ( ! $paypal_enable ) {
												?>
                                                <div class="vi-ui toggle checkbox">
                                                    <input type="checkbox" disabled>
                                                    <label></label>
                                                </div>
                                                <p class="description"><?php esc_html_e( 'You have to enable at least 1 PayPal payment gateway and enter PayPal API to use this option.',
														'woocommerce-orders-tracking' ) ?>
                                                    <a target="_blank"
                                                       href="<?php echo esc_url( admin_url( 'admin.php?page=woocommerce-orders-tracking#paypal' ) ) ?>"><?php esc_html_e( 'View settings',
															'woocommerce-orders-tracking' ) ?></a>
                                                </p>
												<?php
											} else {
												?>
                                                <div class="vi-ui toggle checkbox">
                                                    <input type="checkbox"
                                                           class="<?php echo esc_attr( self::set( 'paypal_enable' ) ) ?>"
                                                           id="<?php echo esc_attr( self::set( 'paypal_enable' ) ) ?>"
                                                           name="<?php echo esc_attr( self::set( 'paypal_enable', true ) ) ?>"
                                                           value="1" <?php checked( self::$settings->get_params( 'paypal_enable' ), '1' ) ?>>
                                                    <label></label>
                                                </div>
                                                <p class="description"><?php esc_html_e( 'Add tracking to PayPal transaction', 'woocommerce-orders-tracking' ) ?>
                                                    <a target="_blank"
                                                       href="<?php echo esc_url( admin_url( 'admin.php?page=woocommerce-orders-tracking#paypal' ) ) ?>"><?php esc_html_e( 'View settings',
															'woocommerce-orders-tracking' ) ?></a>
                                                </p>
												<?php
											}
											?>
                                        </td>
                                    </tr>
									<?php

									$all_order_statuses = wc_get_order_statuses();
									?>
                                    <tr>
                                        <th>
                                            <label for="<?php echo esc_attr( self::set( 'order_status' ) ) ?>"><?php esc_html_e( 'Change order status',
													'woocommerce-orders-tracking' ) ?></label>
                                        </th>
                                        <td>
                                            <select name="<?php echo esc_attr( self::set( 'order_status', true ) ) ?>"
                                                    id="<?php echo esc_attr( self::set( 'order_status' ) ) ?>"
                                                    class="vi-ui fluid dropdown">
                                                <option value=""><?php esc_html_e( 'Not Change', 'woocommerce-orders-tracking' ) ?></option>
												<?php
												if ( count( $all_order_statuses ) ) {
													foreach ( $all_order_statuses as $status_id => $status_name ) {
														?>
                                                        <option value="<?php echo esc_attr( $status_id ) ?>" <?php selected( self::$settings->get_params( 'order_status' ),
															$status_id ) ?> ><?php echo esc_html( $status_name ) ?></option>
														<?php
													}
												}
												?>
                                            </select>
                                        </td>
                                    </tr>
                                    </tbody>
                                </table>
                            </div>
                            <div class="vi-ui segment">
                                <table class="form-table">
                                    <thead>
                                    <tr>
                                        <th><?php esc_html_e( 'Column name', 'woocommerce-orders-tracking' ) ?></th>
                                        <th><?php esc_html_e( 'Map to field', 'woocommerce-orders-tracking' ) ?></th>
                                    </tr>
                                    </thead>
                                    <tbody>
									<?php
									$required_fields = array(
										'order_id',
										'tracking_number',
										'carrier_slug',
									);
									$headers         = array(
										'order_id'        => esc_html__( 'Order ID', 'woocommerce-orders-tracking' ),
										'tracking_number' => esc_html__( 'Tracking Number', 'woocommerce-orders-tracking' ),
										'carrier_slug'    => esc_html__( 'Carrier Slug', 'woocommerce-orders-tracking' ),
										'order_item_id'   => esc_html__( 'Order Item ID', 'woocommerce-orders-tracking' ),
										'order_status'    => esc_html__( 'Order Status', 'woocommerce-orders-tracking' ),
									);
									$description     = array(
										'order_id'        => '',
										'tracking_number' => '',
										'carrier_slug'    => '',
										'order_item_id'   => array(
											esc_html__( 'If Order Item ID is NOT mapped, the first found tracking number of an order will be set for every product line item of that order if "Manage tracking" is "Order items only" and will be set for the order otherwise.',
												'woocommerce-orders-tracking' ),
											esc_html__( 'If Order Item ID is mapped but EMPTY, the respective tracking number will be set for the order if "Manage tracking" is NOT "Order items only" and will be skipped otherwise.',
												'woocommerce-orders-tracking' ),
										),
										'order_status'    => esc_html__( 'If Order Status is mapped, it will override the "Change order status" option above',
											'woocommerce-orders-tracking' ),
									);
									foreach ( $headers as $header_k => $header_v ) {
										?>
                                        <tr>
                                            <td>
                                                <select id="<?php echo esc_attr( self::set( $header_k ) ) ?>"
                                                        class="vi-ui fluid dropdown"
                                                        name="<?php echo esc_attr( self::set( 'map_to', true ) ) ?>[<?php echo esc_attr( $header_k ) ?>]">
                                                    <option value=""><?php esc_html_e( 'Do not map', 'woocommerce-orders-tracking' ) ?></option>
													<?php
													foreach ( $this->header as $file_header ) {
														$selected = '';
														if ( strpos( strtolower( $file_header ), strtolower( $header_v ) ) !== false ) {
															$selected = 'selected';
														}
														?>
                                                        <option value="<?php echo esc_attr( urlencode( $file_header ) ) ?>"<?php echo esc_attr( $selected ) ?>><?php echo esc_html( $file_header ) ?></option>
														<?php
													}
													?>
                                                </select>
                                            </td>
                                            <td>
												<?php
												$label = $header_v;
												if ( in_array( $header_k, $required_fields ) ) {
													$label .= '<strong>(*Required)</strong>';
												}
												?>
                                                <label for="<?php echo esc_attr( self::set( $header_k ) ) ?>"><?php echo wp_kses_post( $label ); ?></label>
                                            </td>
                                        </tr>
										<?php
										if ( ! empty( $description[ $header_k ] ) ) {
											?>
                                            <tr class="description">
                                                <td colspan="2">
                                                    <div class="vi-ui blue small message">
                                                        <ul class="list">
															<?php
															if ( is_array( $description[ $header_k ] ) ) {
																foreach ( $description[ $header_k ] as $desc ) {
																	?>
                                                                    <li>
																		<?php
																		echo esc_html( $desc );
																		?>
                                                                    </li>
																	<?php
																}
															} else {
																?>
                                                                <li>
																	<?php
																	echo esc_html( $description[ $header_k ] );
																	?>
                                                                </li>
																<?php
															}
															?>
                                                        </ul>
                                                    </div>
                                                </td>
                                            </tr>
											<?php
										}
									}
									?>
                                    </tbody>
                                </table>
                            </div>
                            <input type="hidden" name="woo_orders_tracking_file_url"
                                   value="<?php echo esc_attr( $this->file_url ) ?>">
                            <p>
                                <input type="submit" name="woo_orders_tracking_import"
                                       class="vi-ui primary button <?php echo esc_attr( self::set( 'import-continue' ) ) ?>"
                                       value="<?php echo esc_attr__( 'Import', 'woocommerce-orders-tracking' ); ?>">
                            </p>
                        </form>
						<?php
						break;
					case 'import':
						?>
                        <div>
                            <div class="vi-ui indicating progress standard <?php echo esc_attr( self::set( 'import-progress' ) ) ?>">
                                <div class="label"><?php esc_html_e( 'Import tracking numbers', 'woocommerce-orders-tracking' ) ?></div>
                                <div class="bar">
                                    <div class="progress"></div>
                                </div>
                            </div>
                            <div class="vi-ui indicating progress standard <?php echo esc_attr( self::set( 'paypal-progress' ) ) ?>">
                                <div class="label"><?php esc_html_e( 'Add tracking numbers to PayPal', 'woocommerce-orders-tracking' ) ?></div>
                                <div class="bar">
                                    <div class="progress"></div>
                                </div>
                            </div>
                            <div class="vi-ui indicating progress standard <?php echo esc_attr( self::set( 'ppec_paypal-progress' ) ) ?>">
                                <div class="label"><?php esc_html_e( 'Add tracking numbers to PayPal(for orders paid with PayPal Checkout)',
										'woocommerce-orders-tracking' ) ?></div>
                                <div class="bar">
                                    <div class="progress"></div>
                                </div>
                            </div>
                            <div class="vi-ui indicating progress standard <?php echo esc_attr( self::set( 'send-email-progress' ) ) ?>">
                                <div class="label"><?php esc_html_e( 'Schedule to send emails', 'woocommerce-orders-tracking' ) ?></div>
                                <div class="bar">
                                    <div class="progress"></div>
                                </div>
                            </div>
                            <div class="vi-ui small positive message <?php echo esc_attr( self::set( 'view-log-after-import' ) ) ?>"
                                 style="display: none">
                                <div><?php printf( wp_kses_post( __( 'Import completed, please go to <a target="_blank" href="%s">Logs</a> to view import log',// phpcs:ignore WordPress.WP.I18n.MissingTranslatorsComment
										'woocommerce-orders-tracking' ) ),
										esc_url( admin_url( 'admin.php?page=woocommerce-orders-tracking-logs&log_of=import-tracking' ) ) ) ?></div>
                            </div>
                        </div>
						<?php
						break;
					default:
						?>
                        <form class="<?php echo esc_attr( self::set( 'import-container-form' ) ) ?> vi-ui form"
                              method="post"
                              enctype="multipart/form-data">
							<?php
							wp_nonce_field( 'woo_orders_tracking_import_action_nonce', '_woo_orders_tracking_import_nonce' );
							?>
                            <div class="vi-ui positive message <?php echo esc_attr( self::set( 'import-container' ) ) ?>">
                                <div class="header">
                                    <label for="<?php echo esc_attr( self::set( 'import-file' ) ) ?>"><?php esc_html_e( 'Select csv file to import',
											'woocommerce-orders-tracking' ); ?></label>
                                </div>
                                <ul class="list">
                                    <li><?php echo wp_kses_post( __( 'Your csv file should have following columns:<strong>Order id</strong>, <strong>Order item id</strong>, <strong>Tracking number</strong>, <strong>Carrier slug</strong>.',
											'woocommerce-orders-tracking' ) ) ?></li>
                                    <li>
										<?php echo wp_kses_post( __( '<strong>Carrier slug</strong>: slug of an carrier defined in plugin settings, get <strong>Carrier slug list</strong> by ',
											'woocommerce-orders-tracking' ) ) ?>
                                        <input type="submit"
                                               class="vi-ui button green vi-woo-orders-tracking-download-carriers-file"
                                               name="woo_orders_tracking_download_carriers_file"
                                               value="<?php echo esc_attr__( 'Download File', 'woocommerce-orders-tracking' ) ?>">
										<?php printf( wp_kses_post( __( 'If you can not find your carrier, please go to <a target="_blank" href="%s">Plugin settings</a> to Add Carrier',// phpcs:ignore WordPress.WP.I18n.MissingTranslatorsComment
											'woocommerce-orders-tracking' ) ), esc_url( admin_url( 'admin.php?page=woocommerce-orders-tracking#shipping_carriers' ) ) ) ?>
                                    </li>
                                    <li>
										<?php esc_html_e( 'Each tracking number, carrier name,carrier slug, tracking url is set for a product line item of an order. ',
											'woocommerce-orders-tracking' ) ?>
                                        <input type="submit"
                                               class="vi-ui button olive vi-woo-orders-tracking-download-demo-file"
                                               name="woo_orders_tracking_download_demo_file"
                                               value="<?php echo esc_attr__( 'Download Demo', 'woocommerce-orders-tracking' ) ?>">
                                    </li>
                                </ul>
                            </div>
                            <table class="vi-ui celled table center aligned <?php echo esc_attr( self::set( 'order-statuses' ) ) ?>">
                                <thead>
                                <tr>
                                    <th><?php esc_html_e( 'Accepted order status values for mapping', 'woocommerce-orders-tracking' ) ?></th>
                                    <th><?php esc_html_e( 'Status', 'woocommerce-orders-tracking' ) ?></th>
                                </tr>
                                </thead>
                                <tbody>
								<?php
								$all_order_statuses = wc_get_order_statuses();
								if ( count( $all_order_statuses ) ) {
									foreach ( $all_order_statuses as $status_id => $status_name ) {
										?>
                                        <tr>
                                            <td><?php echo esc_html( substr( $status_id, 3 ) ) ?></td>
                                            <td><?php echo esc_html( $status_name ) ?></td>
                                        </tr>
										<?php
									}
								}
								?>
                                </tbody>
                            </table>

                        </form>
                        <form class="<?php echo esc_attr( self::set( 'import-container-form' ) ) ?> vi-ui form"
                              method="post"
                              enctype="multipart/form-data">
							<?php
							wp_nonce_field( 'woo_orders_tracking_import_action_nonce', '_woo_orders_tracking_import_nonce' );

							?>
                            <div class="<?php echo esc_attr( self::set( 'import-container' ) ) ?>">
                                <div>
                                    <input type="file" name="woo_orders_tracking_file"
                                           id="<?php echo esc_attr( self::set( 'import-file' ) ) ?>"
                                           class="<?php echo esc_attr( self::set( 'import-file' ) ) ?>"
                                           accept=".csv"
                                           required>
                                </div>
                            </div>
                            <p><input type="submit" name="woo_orders_tracking_select_file"
                                      class="vi-ui primary button <?php echo esc_attr( self::set( 'import-continue' ) ) ?>"
                                      value="<?php echo esc_attr__( 'Continue', 'woocommerce-orders-tracking' ); ?>">
                            </p>
                        </form>
					<?php
				}
				?>
            </div>
        </div>
		<?php
	}

	/**
	 * Send email
	 *
	 * Do not move this function to an other class as it's called statically in customers' custom works and ALD plugin
	 *
	 * @param       $order_id
	 * @param array $updated_items
	 * @param bool  $update_scheduled_emails
	 *
	 * @return bool
	 * @throws Exception
	 */
	public static function send_mail( $order_id, $updated_items = array(), $update_scheduled_emails = false ) {
		return VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_EMAIL::send_email( $order_id, $updated_items, $update_scheduled_emails );
	}

	private static function wc_log( $content, $level = 'info', $source = '' ) {
		VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_LOG::wc_log( $content, $source ? 'import-tracking-' . $source : 'import-tracking', $level );
	}
}