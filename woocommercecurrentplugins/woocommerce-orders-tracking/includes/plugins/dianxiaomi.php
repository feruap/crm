<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Dianxiaomi
 */
if ( ! class_exists( 'VI_WOOCOMMERCE_ORDERS_TRACKING_PLUGINS_Dianxiaomi' ) ) {
	class VI_WOOCOMMERCE_ORDERS_TRACKING_PLUGINS_Dianxiaomi {
		protected static $settings, $cache=[];

		/**
		 * VI_WOOCOMMERCE_ORDERS_TRACKING_PLUGINS_Dianxiaomi constructor.
		 */
		public function __construct() {
			self::$settings = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_instance();
            self::$cache['dianxiaomi_active'] = is_plugin_active( 'dianxiaomi/dianxiaomi.php' ) ;
			if ( self::$cache['dianxiaomi_active'] ) {
				add_action( 'admin_enqueue_scripts', array( $this, 'admin_enqueue_scripts' ) );
				add_action( 'admin_init', array( $this, 'admin_init' ) );
			}
			add_action( 'woo_orders_tracking_settings_integration', array( $this, 'add_settings' ) );
			add_filter( 'woo_orders_tracking_update_settings_args', array($this, 'woo_orders_tracking_update_settings_args' ),10,1);
			if ( self::$settings->get_params( 'dianxiaomi_enable' ) ) {
				add_filter( 'dianxiaomi_api_order_response', array( $this, 'dianxiaomi_api_order_response' ), 99, 4 );
				add_filter( 'woocommerce_rest_prepare_order_note', array( $this, 'woocommerce_rest_prepare_order_note' ), 99,3 );
			}
		}
		public function woo_orders_tracking_update_settings_args($args){
			if ( ! isset( $_REQUEST['_vi_wot_setting_nonce'] ) || ! wp_verify_nonce( $_REQUEST['_vi_wot_setting_nonce'], 'vi_wot_setting_action_nonce' ) ) {
				return $args;
			}
			$args['dianxiaomi_enable'] = isset($_POST['dianxiaomi_enable']) ? sanitize_text_field(wp_unslash($_POST['dianxiaomi_enable'])) :'';
			$args['dianxiaomi_send_email'] = isset($_POST['dianxiaomi_send_email']) ? sanitize_text_field(wp_unslash($_POST['dianxiaomi_send_email'])) :'';
			$args['dianxiaomi_change_status'] = isset($_POST['dianxiaomi_change_status']) ? sanitize_text_field(wp_unslash($_POST['dianxiaomi_change_status'])) :'';
			$args['dianxiaomi_api_courier_mapping'] = isset($_POST['dianxiaomi_api_courier_mapping']) ? wc_clean(wp_unslash($_POST['dianxiaomi_api_courier_mapping'])) :[];
			$args['dianxiaomi_debug'] = isset($_POST['dianxiaomi_debug']) ? sanitize_text_field(wp_unslash($_POST['dianxiaomi_debug'])) :'';
			return $args;
		}
		/**
		 * Prepare a single order note output for response.
		 *
		 * @param WP_Comment      $note    Order note object.
		 * @param WP_REST_Request $request Request object.
		 * @return WP_REST_Response $response Response data.
		 */
        public function woocommerce_rest_prepare_order_note($response, $note, $request){
	        $params = $request->get_params();
	        self::debug_log( 'Check maybe add tracking from Dianxiaomi : ' );
            $typeReference = isset($params['typeReference']['type'])? $params['typeReference']['type'] : '';
            $note = $params['note']??'';
            $order_id = $params['order_id']??'';
            if (!$order_id || !strpos($note,'Your order has been shipped by') || $typeReference !='com.icoderman.woocommerce3.entity.WooOrderNote'){
	            ob_start();
	            var_dump('Not found data to add tracking number');
	            var_dump($params);
	            var_dump($request);
	            self::debug_log( ob_get_clean() );
                return $response;
            }
	        $order = wc_get_order($order_id);
            if (!$order){
	            self::debug_log( 'Not found order with order_id : '.$order_id );
            }
            preg_match('/Your order has been shipped by (.+?)\./m',$note,$match);
            $carrier_send = $tracking_number = '';
            if (!empty($match[1])){
                $carrier_send = trim($match[1]);
            }
	        preg_match('/. The tracking number is <\/span><span style=\"color:#005b9a;font-weight:bold;text-decoration:underline\">(.*)<\/span><span>/m',$note,$match);
	        if (!empty($match[1])){
		        $tracking_number = trim($match[1]);
	        }
            if (!$carrier_send || !$tracking_number){
	            ob_start();
	            var_dump('Not found carrier/ tracking number to save data');
	            var_dump($carrier_send);
	            var_dump($tracking_number);
	            var_dump($params);
	            var_dump($request);
	            self::debug_log( ob_get_clean() );
	            return $response;
            }
            $courier_mapping = self::$settings->get_params( 'dianxiaomi_api_courier_mapping' );
	        $carrier_slug = '';
	        foreach ($courier_mapping as $item){
		        if (isset($item['name'], $item['map']) && $carrier_send == trim($item['name'])){
			        $carrier_slug = $item['map'];
		        }
	        }
	        $carrier = self::$settings->get_shipping_carrier_by_slug($carrier_slug);
	        if (!$carrier_slug || !is_array( $carrier ) || empty( $carrier )){
		        ob_start();
		        var_dump('Not found Woo Orders Tracking carrier');
		        var_dump($params);
		        var_dump($request);
		        self::debug_log( ob_get_clean() );
		        return $response;
	        }
	        $carrier_name    = ! empty( $carrier['display_name'] )? $carrier['display_name'] :($carrier['name'] ?? $carrier_slug);
	        $carrier_url     = $carrier['url'] ?? '';
	        $carrier_type = $carrier['carrier_type']??'';
	        $line_items = $order->get_items();
            if (empty($line_items)){
	            ob_start();
	            var_dump('$line_items not found');
	            var_dump($params);
	            var_dump($request);
	            self::debug_log( ob_get_clean() );
	            return $response;
            }
	        $tracking_url = self::$settings->get_url_tracking( $carrier_url, $tracking_number, $carrier_slug, $order->get_shipping_postcode(), false, false, $order_id );
	        $order_tracking_change = false;
	        $send_mail_array       = array();
	        $now                   = time();
	        foreach ( $line_items as $item_id => $item ) {
		        $tracking_change       = true;
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
			        foreach ( $item_tracking_data as $order_tracking_data_k => $order_tracking_data_v ) {
				        if ( $order_tracking_data_v['tracking_number'] == $tracking_number ) {
					        $current_tracking_data = $order_tracking_data_v;
					        if ( $order_tracking_data_k === ( count( $item_tracking_data ) - 1 ) ) {
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

		        $item_tracking_data[] = $current_tracking_data;
		        wc_update_order_item_meta( $item_id, '_vi_wot_order_item_tracking_data', vi_wot_json_encode( $item_tracking_data ) );
		        $send_mail_array[] = array(
			        'order_item_id'   => $item_id,
			        'order_item_name' => $item->get_name(),
			        'tracking_number' => $tracking_number,
			        'carrier_url'     => $carrier_url,
			        'tracking_url'    => $tracking_url,
			        'carrier_name'    => $carrier_name,
		        );

		        if ( $tracking_change ) {
			        $order_tracking_change = true;
		        }
	        }
	        if ( $order_tracking_change ) {
		        self::debug_log( 'update : true' );
		        if ( self::$settings->get_params( 'dianxiaomi_send_email' ) && count( $send_mail_array ) ) {
			        VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_EMAIL::send_email( $order_id, $send_mail_array, true );
		        }
		        $dianxiaomi_change_status = self::$settings->get_params( 'dianxiaomi_change_status' );
		        $current_status           = 'wc-' . $order->get_status();
		        ob_start();
		        var_dump( 'current order status : ' . $current_status );
		        var_dump( '$dianxiaomi_change_status : ' . $dianxiaomi_change_status );
		        self::debug_log( ob_get_clean() );
		        if ( $dianxiaomi_change_status && $current_status != $dianxiaomi_change_status && in_array( $dianxiaomi_change_status, array_keys( wc_get_order_statuses() ) ) ) {
			        ob_start();
			        var_dump( 'update order status : true' );
			        self::debug_log( ob_get_clean() );
			        $order->update_status( $dianxiaomi_change_status );
		        }
		        VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::add_tracking_to_service( $tracking_number, $carrier_slug, $carrier_name, $order_id, $api_error );
	        } else {
		        self::debug_log( 'update : false' );
		        ob_start();
		        var_dump($params);
		        var_dump($request);
		        self::debug_log( ob_get_clean() );
	        }
            return $response;
        }
		public function add_settings() {
			self::$settings = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_instance(true);
			?>
            <div class="vi-ui segment">
                <div class="vi-ui small positive message">
                    <div><?php esc_html_e( 'Dianxiaomi integration', 'woocommerce-orders-tracking' ) ?></div>
                </div>
                <table class="form-table">
                    <tbody>
                    <tr>
                        <th>
                            <label for="<?php echo esc_attr( self::set( 'dianxiaomi_enable' ) ) ?>"><?php esc_html_e( 'Enable', 'woocommerce-orders-tracking' ) ?></label>
                        </th>
                        <td>
                            <div class="vi-ui toggle checkbox">
                                <input type="checkbox"
                                       name="dianxiaomi_enable"
                                       id="<?php echo esc_attr( self::set( 'dianxiaomi_enable' ) ) ?>"
                                       value="1" <?php checked( self::$settings->get_params( 'dianxiaomi_enable' ), '1' ) ?>><label><?php esc_html_e( 'Enable Dianxiaomi integration', 'woocommerce-orders-tracking' ) ?></label>
                            </div>
                            <p><?php esc_html_e( 'Enable this to sync tracking numbers with Dianxiaomi plugin whenever you sync Dianxiaomi with your store', 'woocommerce-orders-tracking' ) ?></p>
                        </td>
                    </tr>
                    <tr>
                        <th>
                            <label for="<?php echo esc_attr( self::set( 'dianxiaomi_send_email' ) ) ?>"><?php esc_html_e( 'Send email', 'woocommerce-orders-tracking' ) ?></label>
                        </th>
                        <td>
                            <div class="vi-ui toggle checkbox">
                                <input type="checkbox"
                                       name="dianxiaomi_send_email"
                                       id="<?php echo esc_attr( self::set( 'dianxiaomi_send_email' ) ) ?>"
                                       value="1" <?php checked( self::$settings->get_params( 'dianxiaomi_send_email' ), '1' ) ?>><label></label>
                            </div>
                            <p><?php esc_html_e( 'When tracking numbers are synced with Dianxiaomi, send an email to customers if tracking info changes', 'woocommerce-orders-tracking' ) ?></p>
                        </td>
                    </tr>
                    <tr>
                        <th>
                            <label for="<?php echo esc_attr( self::set( 'dianxiaomi_change_status' ) ) ?>"><?php esc_html_e( 'Change order status', 'woocommerce-orders-tracking' ) ?></label>
                        </th>
                        <td>
							<?php
							$dianxiaomi_change_status = self::$settings->get_params( 'dianxiaomi_change_status' );
							?>
                            <select id="<?php echo esc_attr( self::set( 'dianxiaomi_change_status' ) ) ?>"
                                    class="vi-ui dropdown"
                                    name="dianxiaomi_change_status">
                                <option value=""><?php esc_html_e( 'Not change', 'woocommerce-orders-tracking' ) ?></option>
								<?php
								foreach ( wc_get_order_statuses() as $all_option_k => $all_option_v ) {
									?>
                                    <option value="<?php echo esc_attr( $all_option_k ) ?>" <?php selected( $all_option_k, $dianxiaomi_change_status ) ?>><?php echo esc_html( $all_option_v ) ?></option>
									<?php
								}
								?>
                            </select>
                            <p><?php esc_html_e( 'Change order status when tracking number is added from Dianxiaomi', 'woocommerce-orders-tracking' ) ?></p>
                        </td>
                    </tr>
                    <tr>
                        <th>
                            <label for="<?php echo esc_attr( self::set( 'dianxiaomi_debug' ) ) ?>"><?php esc_html_e( 'Debug', 'woocommerce-orders-tracking' ) ?></label>
                        </th>
                        <td>
                            <div class="vi-ui toggle checkbox">
                                <input type="checkbox"
                                       name="dianxiaomi_debug"
                                       id="<?php echo esc_attr( self::set( 'dianxiaomi_debug' ) ) ?>"
                                       value="1" <?php checked( self::$settings->get_params( 'dianxiaomi_debug' ), '1' ) ?>><label></label>
                            </div>
                            <p class="description">
								<?php esc_html_e( 'If enabled, The errors will be logged.', 'woocommerce-orders-tracking' ); ?>
                            </p>
                        </td>
                    </tr>
                    </tbody>
                </table>
                <div class="vi-ui positive tiny message">
                    <div class="header"><?php esc_html_e('Carriers mapping', 'woocommerce-orders-tracking');?></div>
                    <ul class="list">
                        <li><?php esc_html_e('Use this only if your Dianxiaomi account is integrated via the REST API.', 'woocommerce-orders-tracking'); ?></li>
                        <li><?php esc_html_e('Please save first to load all shipping carriers.', 'woocommerce-orders-tracking'); ?></li>
                    </ul>
                </div>
                <table class="vi-ui celled table vi-wot-dianxiaomi-carriers-mapping vi-wot-carriers-mapping" data-integration="dianxiaomi"
                       data-integration_name="dianxiaomi_api_courier_mapping">
                    <thead>
                    <tr>
                        <th><?php esc_html_e('Dianxiaomi carrier', 'woocommerce-orders-tracking'); ?></th>
                        <th><?php esc_html_e('Woo Orders Tracking carrier', 'woocommerce-orders-tracking'); ?></th>
                        <th class="vi-wot-dianxiaomi-carriers-mapping-action vi-wot-carriers-mapping-action"></th>
                    </tr>
                    </thead>
                    <tbody>
		            <?php
		            $courier_mapping = self::$settings->get_params( 'dianxiaomi_api_courier_mapping' );
		            if ($courier_mapping === false) {
			            $courier_mapping = array(
				            array(
					            'name' => 'DHL',
					            'map'  => 'dhl',
				            )
			            );
		            }
		            if ( is_array( $courier_mapping ) && !empty( $courier_mapping ) ) {
			            $carriers= self::$settings::get_carriers();
			            foreach ( $courier_mapping as $k => $item ) {
				            ?>
                            <tr class="vi-wot-dianxiaomi-carrier-mapping vi-wot-carrier-mapping">
                                <td>
                                    <input type="text" name="dianxiaomi_api_courier_mapping[<?php echo esc_attr( $k ) ?>][name]"
                                           value="<?php echo esc_attr( $item['name'] ??'' ) ?>">
                                </td>
                                <td>
                                    <select name="dianxiaomi_api_courier_mapping[<?php echo esc_attr( $k ) ?>][map]"
                                            class="vi-ui fluid search dropdown vi-wot-dianxiaomi-mapping-carrier vi-wot-mapping-carrier">
                                        <option value=""></option>
							            <?php
							            foreach ( $carriers as $carrier ) {
								            if (!isset($carrier['slug'], $carrier['name'])){
									            continue;
								            }
								            ?>
                                            <option value="<?php echo esc_attr( $carrier['slug'] ) ?>" <?php selected($item['map']??'', $carrier['slug']) ?>><?php echo esc_html( $carrier['name'] ) ?></option>
								            <?php
							            }
							            ?>
                                    </select>
                                </td>
                                <td>
                                    <i class="icon trash alternate outline vi-wot-dianxiaomi-remove-carrier vi-wot-remove-carrier"></i>
                                </td>
                            </tr>
				            <?php
			            }
		            }
		            ?>
                    </tbody>
                </table>
                <span class="button vi-wot-dianxiaomi-add-carrier vi-wot-add-carrier"><?php esc_html_e('Add Dianxiaomi carrier', 'woocommerce-orders-tracking'); ?></span>
	            <?php
	            do_action( 'woo_orders_tracking_settings_dianxiaomi' );
	            ?>
            </div>
			<?php
		}

		/**
		 * @param $order_data
		 * @param $order
		 * @param $fields
		 * @param $server
		 *
		 * @return mixed
		 * @throws Exception
		 */
		public function dianxiaomi_api_order_response( $order_data, $order, $fields, $server ) {
			try {
				self::debug_log( 'start sync to order: ' . ( $order_data['id'] ?? 'order_id not found' ) );
				if ( isset( $order_data['trackings'] ) && is_array( $order_data['trackings'] ) && count( $order_data['trackings'] ) ) {
					$trackings = array_pop( $order_data['trackings'] );
					if ( ! empty( $trackings['tracking_provider'] ) && ! empty( $trackings['tracking_number'] ) ) {
						$tracking_number = $trackings['tracking_number'];
						$mapping         = self::$settings->get_params( 'dianxiaomi_courier_mapping' );
						if ( is_array( $mapping ) && count( $mapping ) ) {
							if ( ! empty( $mapping[ $trackings['tracking_provider'] ] ) ) {
								$carrier_slug = $mapping[ $trackings['tracking_provider'] ];
								$carrier      = self::$settings->get_shipping_carrier_by_slug( $carrier_slug );
								if ( is_array( $carrier ) && count( $carrier ) ) {
									$carrier_url  = $carrier['url'];
									$carrier_name = $carrier['name'];
									if ( ! empty( $carrier['display_name'] ) ) {
										$display_name = $carrier['display_name'];
									} else {
										$display_name = $carrier_name;
									}
									$carrier_type = $carrier['carrier_type'];
									$order_id     = isset( $order_data['id'] ) ? $order_data['id'] : '';
									if ( $order_id ) {
										$order = wc_get_order( $order_id );
										if ( $order ) {
											$line_items = $order->get_items();
											if ( count( $line_items ) ) {
												$tracking_url_import   = self::$settings->get_url_tracking( $carrier_url, $tracking_number, $carrier_slug, $order->get_shipping_postcode(), false, true, $order_id );
												$order_tracking_change = false;
												$send_mail_array       = array();
												$now                   = time();
												foreach ( $line_items as $item_id => $item ) {
													$tracking_change       = true;
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
														foreach ( $item_tracking_data as $order_tracking_data_k => $order_tracking_data_v ) {
															if ( $order_tracking_data_v['tracking_number'] == $tracking_number ) {
																$current_tracking_data = $order_tracking_data_v;
																if ( $order_tracking_data_k === ( count( $item_tracking_data ) - 1 ) ) {
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

													$item_tracking_data[] = $current_tracking_data;

													self::debug_log( var_export( $item_tracking_data, true ) );
													wc_update_order_item_meta( $item_id, '_vi_wot_order_item_tracking_data', vi_wot_json_encode( $item_tracking_data ) );
													$send_mail_array[] = array(
														'order_item_id'   => $item_id,
														'order_item_name' => $item->get_name(),
														'tracking_number' => $tracking_number,
														'carrier_url'     => $carrier_url,
														'tracking_url'    => $tracking_url_import,
														'carrier_name'    => $display_name,
													);

													if ( $tracking_change ) {
														$order_tracking_change = true;
													}
												}
												if ( $server->method === 'POST' && $order_tracking_change ) {
													self::debug_log( 'update : true' );
													if ( self::$settings->get_params( 'dianxiaomi_send_email' ) && count( $send_mail_array ) ) {
														VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_EMAIL::send_email( $order_id, $send_mail_array, true );
													}
													$dianxiaomi_change_status = self::$settings->get_params( 'dianxiaomi_change_status' );
													$current_status           = 'wc-' . $order->get_status();
													ob_start();
													var_dump( 'current order status : ' . $current_status );
													var_dump( '$dianxiaomi_change_status : ' . $dianxiaomi_change_status );
													self::debug_log( ob_get_clean() );
													if ( $dianxiaomi_change_status && $current_status != $dianxiaomi_change_status && in_array( $dianxiaomi_change_status, array_keys( wc_get_order_statuses() ) ) ) {
														ob_start();
														var_dump( 'update order status : true' );
														self::debug_log( ob_get_clean() );
														$order->update_status( $dianxiaomi_change_status );
													}
													VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::add_tracking_to_service( $tracking_number, $carrier_slug, $carrier_name, $order_id, $api_error );
												} else {
													self::debug_log( 'update : false' );
													ob_start();
													var_dump( 'method : ' . ( $server->method ?? 'not found' ) );
													var_dump( '$order_tracking_change: ' );
													var_dump( $order_tracking_change );
													self::debug_log( ob_get_clean() );
												}
											} else {
												self::debug_log( '$line_items not found' );
											}
										} else {
											self::debug_log( '$order not found' );
										}
									}
								} else {
									self::debug_log( 'shipping_carrier_by_slug -' . $carrier_slug . ' not found' );
									self::debug_log( var_export( $carrier, true ) );
								}
							} else {
								self::debug_log( 'can not match : ' . $trackings['tracking_provider'] );
								self::debug_log( var_export( $mapping, true ) );
							}
						} else {
							self::debug_log( 'dianxiaomi_courier_mapping is empty' );
							self::debug_log( var_export( $mapping, true ) );
						}
					} else {
						self::debug_log( 'tracking_provider is empty' );
						self::debug_log( var_export( $trackings, true ) );
					}
				}
			} catch ( Error $error ) {
				self::debug_log( $error->getMessage() );
			} catch ( Exception $exception ) {
				self::debug_log( $exception->getMessage() );
			}

			return $order_data;
		}

		private static function debug_log( $content) {
			if ( self::$settings->get_params( 'dianxiaomi_debug' ) ) {
				VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_LOG::wc_log( $content, 'dianxiaomi-debug', 'debug' );
			}
		}

		public function admin_init() {
			$option_page = isset( $_POST['option_page'] ) ? sanitize_text_field( $_POST['option_page'] ) : '';
			$action      = isset( $_POST['action'] ) ? sanitize_text_field( $_POST['action'] ) : '';
			if ( $option_page === 'dianxiaomi_option_group' && $action === 'update' && isset( $_POST['dianxiaomi_option_name'] ) ) {
				$dianxiaomi_courier_mapping           = isset( $_POST['dianxiaomi_courier_mapping'] ) ? stripslashes_deep( $_POST['dianxiaomi_courier_mapping'] ) : array();
				$params                               = self::$settings->get_params();
				$params['dianxiaomi_courier_mapping'] = $dianxiaomi_courier_mapping;
				update_option( 'woo_orders_tracking_settings', $params );
			}
		}

		public function admin_enqueue_scripts() {
			global $pagenow;
			$page = isset( $_GET['page'] ) ? sanitize_text_field( $_GET['page'] ) : '';// phpcs:ignore WordPress.Security.NonceVerification.Recommended
			if ( $pagenow === 'options-general.php' && $page === 'dianxiaomi-setting-admin' ) {
				wp_enqueue_script( 'woo-orders-tracking-mapping-couriers', VI_WOOCOMMERCE_ORDERS_TRACKING_JS . 'mapping-couriers.js', array( 'jquery' ), VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION, false );
				$dianxiaomi_option_name = get_option( 'dianxiaomi_option_name' );
                $args = array(
	                'couriers_title'        => esc_html__( 'Dianxiaomi courier', 'woocommerce-orders-tracking' ),
	                'couriers_mapping_name' => 'dianxiaomi_courier_mapping',
	                'couriers_mapping'      => self::$settings->get_params( 'dianxiaomi_courier_mapping' ),
	                'carriers'              => VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_carriers(),
	                'couriers'              => empty( $dianxiaomi_option_name['couriers'] ) ? array() : explode( ',', $dianxiaomi_option_name['couriers'] ),
                );
				wp_localize_script( 'woo-orders-tracking-mapping-couriers', 'woo_orders_tracking_mapping_couriers', $args );
			}
		}

		private static function set( $name, $set_name = false ) {
			return VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::set( $name, $set_name );
		}
	}
}
