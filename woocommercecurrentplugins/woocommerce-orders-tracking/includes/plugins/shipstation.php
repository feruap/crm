<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
/**
 * ShipStation - WooCommerce - ShipStation Integration
 */
if ( ! class_exists( 'VI_WOOCOMMERCE_ORDERS_TRACKING_PLUGINS_Shipstation' ) ) {
	class VI_WOOCOMMERCE_ORDERS_TRACKING_PLUGINS_Shipstation{
		protected static $settings;
		public function __construct() {
			if ( ! is_plugin_active( 'woocommerce-shipstation-integration/woocommerce-shipstation.php' ) ) {
				return;
			}
			self::$settings = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_instance();
			add_filter('woo_orders_tracking_update_settings_args', array($this, 'woo_orders_tracking_update_settings_args'),10,1);
			add_filter('vi_wot_tab_menu', array($this, 'add_tab_menu'),10,1);
			add_action('vi_wot_tab_settings', array($this,'add_settings'));
			add_action('woocommerce_shipstation_shipnotify', array($this,'add_tracking'), 10, 2);
            if (self::$settings->get_params('shipstation_cancel_order_note')){
                add_filter('woocommerce_new_order_note_data', array($this,'cancel_sending_email'), PHP_INT_MAX, 2);
            }
		}
		public function add_tab_menu($tabs){
			$tabs['shipstation'] = esc_html__('ShipStation', 'woocommerce-orders-tracking');
			return $tabs;
		}
		public function woo_orders_tracking_update_settings_args($args){
			if ( ! isset( $_REQUEST['_vi_wot_setting_nonce'] ) || ! wp_verify_nonce( $_REQUEST['_vi_wot_setting_nonce'], 'vi_wot_setting_action_nonce' ) ) {
				return $args;
			}
			$args['shipstation_enable'] = isset($_POST['shipstation_enable']) ? sanitize_text_field(wp_unslash($_POST['shipstation_enable'])) :'';
			$args['shipstation_cancel_order_note'] = isset($_POST['shipstation_cancel_order_note']) ? sanitize_text_field(wp_unslash($_POST['shipstation_cancel_order_note'])) :'';
			$args['shipstation_send_email'] = isset($_POST['shipstation_send_email']) ? sanitize_text_field(wp_unslash($_POST['shipstation_send_email'])) :'';
			$args['shipstation_send_sms'] = isset($_POST['shipstation_send_sms']) ? sanitize_text_field(wp_unslash($_POST['shipstation_send_sms'])) :'';
			$args['shipstation_paypal_enable'] = isset($_POST['shipstation_paypal_enable']) ? sanitize_text_field(wp_unslash($_POST['shipstation_paypal_enable'])) :'';
			$args['shipstation_courier_mapping'] = isset($_POST['shipstation_courier_mapping']) ? wc_clean(wp_unslash($_POST['shipstation_courier_mapping'])) :array();
			$args['shipstation_debug'] = isset($_POST['shipstation_debug']) ? sanitize_text_field(wp_unslash($_POST['shipstation_debug'])) :'';
			return $args;
		}
		public function add_settings(){
			self::$settings = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_instance(true);
			?>
            <div class="vi-ui bottom attached tab segment" data-tab="shipstation">
                <table class="form-table">
                    <tbody>
                    <tr>
                        <th>
                            <label for="shipstation_enable"><?php esc_html_e( 'Enable', 'woocommerce-orders-tracking' ) ?></label>
                        </th>
                        <td>
                            <div class="vi-ui toggle checkbox">
                                <input type="checkbox" name="shipstation_enable" id="shipstation_enable"
                                       value="1" <?php checked( self::$settings->get_params( 'shipstation_enable' ), '1' ) ?>><label></label>
                            </div>
                            <p><?php esc_html_e( 'Enable this to sync tracking numbers with \'WooCommerce - ShipStation Integration\' plugin whenever you sync ShipStation with your store', 'woocommerce-orders-tracking' ) ?></p>
                        </td>
                    </tr>
                    <tr>
                        <th>
                            <label for="shipstation_cancel_order_note"><?php esc_html_e( 'Order note', 'woocommerce-orders-tracking' ) ?></label>
                        </th>
                        <td>
                            <div class="vi-ui toggle checkbox">
                                <input type="checkbox" name="shipstation_cancel_order_note" id="shipstation_cancel_order_note"
                                       value="1" <?php checked( self::$settings->get_params( 'shipstation_cancel_order_note' ), '1' ) ?>><label></label>
                            </div>
                            <p class="description">
								<?php esc_html_e( 'Cancel sending an email order note which includes a tracking number  to customers', 'woocommerce-orders-tracking' ) ?>
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <th>
                            <label for="shipstation_send_email"><?php esc_html_e( 'Send email', 'woocommerce-orders-tracking' ) ?></label>
                        </th>
                        <td>
                            <div class="vi-ui toggle checkbox">
                                <input type="checkbox" name="shipstation_send_email" id="shipstation_send_email"
                                       value="1" <?php checked( self::$settings->get_params( 'shipstation_send_email' ), '1' ) ?>><label></label>
                            </div>
                            <p class="description">
								<?php esc_html_e( 'When tracking numbers are synced with ShipStation, send an email to customers if tracking info changes', 'woocommerce-orders-tracking' ) ?>
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <th>
                            <label for="shipstation_send_sms"><?php esc_html_e( 'Send SMS', 'woocommerce-orders-tracking' ) ?></label>
                        </th>
                        <td>
                            <div class="vi-ui toggle checkbox">
                                <input type="checkbox" name="shipstation_send_sms" id="shipstation_send_sms"
                                       value="1" <?php checked( self::$settings->get_params( 'shipstation_send_sms' ), '1' ) ?>><label></label>
                            </div>
                            <p class="description">
								<?php esc_html_e( 'When tracking numbers are synced with ShipStation, send an SMS to customers if tracking info changes', 'woocommerce-orders-tracking' ) ?>
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <th>
                            <label for="shipstation_paypal_enable"><?php esc_html_e( 'Add tracking number to PayPal', 'woocommerce-orders-tracking' ) ?></label>
                        </th>
                        <td>
                            <div class="vi-ui toggle checkbox">
                                <input type="checkbox" name="shipstation_paypal_enable" id="shipstation_paypal_enable"
                                       value="1" <?php checked( self::$settings->get_params( 'shipstation_paypal_enable' ), '1' ) ?>><label></label>
                            </div>
                            <p class="description">
								<?php esc_html_e( 'When tracking numbers are synced with ShipStation,  automatically add tracking number to PayPal. Make sure you configure PayPal API correctly', 'woocommerce-orders-tracking' ) ?>
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <th>
                            <label for="shipstation_debug"><?php esc_html_e( 'Debug', 'woocommerce-orders-tracking' ) ?></label>
                        </th>
                        <td>
                            <div class="vi-ui toggle checkbox">
                                <input type="checkbox" name="shipstation_debug" id="shipstation_debug"
                                       value="1" <?php checked( self::$settings->get_params( 'shipstation_debug' ), '1' ) ?>><label></label>
                            </div>
                            <p class="description">
								<?php esc_html_e('If enabled, The errors will be logged.', 'woocommerce-orders-tracking'); ?>
                            </p>
                        </td>
                    </tr>
                    </tbody>
                </table>
                <div class="vi-ui positive tiny message">
                    <div class="header"><?php esc_html_e('Carriers mapping', 'woocommerce-orders-tracking');?></div>
                    <ul class="list">
                        <li><?php esc_html_e('Please save first to load all shipping carriers.', 'woocommerce-orders-tracking'); ?></li>
                    </ul>
                </div>
                <table class="vi-ui celled table vi-wot-shipstation-carriers-mapping">
                    <thead>
                    <tr>
                        <th><?php esc_html_e('ShipStation carrier', 'woocommerce-orders-tracking'); ?></th>
                        <th><?php esc_html_e('Woo Orders Tracking carrier', 'woocommerce-orders-tracking'); ?></th>
                        <th class="vi-wot-shipstation-carriers-mapping-action"></th>
                    </tr>
                    </thead>
                    <tbody>
					<?php
					$courier_mapping = self::$settings->get_params( 'shipstation_courier_mapping' );
					if ($courier_mapping === false) {
						$courier_mapping = array(
							array(
								'name' => 'DHL',
								'map'  => 'dhl',
							),
							array(
								'name' => 'USPS',
								'map'  => 'usps',
							),
						);
					}
					if ( is_array( $courier_mapping ) && count( $courier_mapping ) ) {
						$carriers= self::$settings::get_carriers();
						foreach ( $courier_mapping as $k => $item ) {
							?>
                            <tr class="vi-wot-shipstation-carrie-mapping">
                                <td>
                                    <input type="text" name="shipstation_courier_mapping[<?php echo esc_attr( $k ) ?>][name]"
                                           value="<?php echo esc_attr( $item['name'] ??'' ) ?>">
                                </td>
                                <td>
                                    <select name="shipstation_courier_mapping[<?php echo esc_attr( $k ) ?>][map]"
                                            class="vi-ui fluid search dropdown vi-wot-shipstation-mapping-carrier">
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
                                    <i class="icon trash alternate outline vi-wot-shipstation-remove-carrier"></i>
                                </td>
                            </tr>
							<?php
						}
					}
					?>
                    </tbody>
                </table>
                <span class="button vi-wot-shipstation-add-carrier"><?php esc_html_e('Add ShipStation carrier', 'woocommerce-orders-tracking'); ?></span>
				<?php
				do_action( 'woo_orders_tracking_settings_shipstation' );
				?>
            </div>
			<?php
		}
        public function cancel_sending_email($args, $info){
	        if ( ! isset( $_REQUEST['_vi_wot_setting_nonce'] ) || ! wp_verify_nonce( $_REQUEST['_vi_wot_setting_nonce'], 'vi_wot_setting_action_nonce' ) ) {
		        return $args;
	        }
            $is_customer_note = $info['is_customer_note'] ?? '';
            $order_id = $info['order_id'] ?? 0;
            $comment_agent = $args['comment_agent'] ?? '';
            $comment_author = $args['comment_author'] ?? '';
            $comment_content = $args['comment_content'] ?? '';
	        $tracking_number = empty( $_GET['tracking_number'] ) ? '' : wc_clean( $_GET['tracking_number'] );
	        $carrier         = empty( $_GET['carrier'] ) ? '' : wc_clean( $_GET['carrier'] );
            if ($is_customer_note) {
	            ob_start();
	            var_dump( 'cancel_sending_email : ' );
	            var_dump( $_GET );
	            self::debug_log( ob_get_clean() );
            }
            if ($order_id && $is_customer_note && $comment_agent === $comment_author && $comment_author ==='WooCommerce' &&
                $comment_content && $tracking_number && $carrier && strpos($comment_content, $tracking_number) && strpos($comment_content, $carrier)){
                remove_all_actions('woocommerce_new_customer_note');
            }
            return $args;
        }
		/**
		 * @param $order WC_Order
		 * @param $param array
		 *
		 */
		public function add_tracking($order, $param){
			if (!self::$settings->get_params('shipstation_enable') || !$order || !$order->get_id() || empty($param)){
				return;
			}
			ob_start();
			var_dump('order_id : '.$order->get_id());
			var_dump($param);
			self::debug_log( ob_get_clean() );
			$tracking_number = $param['tracking_number'] ?? '';
			$carrier = $param['carrier'] ?? '';
			$shipstation_xml = $param['xml'] ?? '';
			if (!$tracking_number || !$carrier || empty($shipstation_xml) || ! function_exists( 'simplexml_import_dom' )){
				self::debug_log( 'Not found information to add tracking' );
				return;
			}
			$courier_mapping = self::$settings->get_params( 'shipstation_courier_mapping' );
			$carrier_slug = '';
			foreach ($courier_mapping as $item){
				if (isset($item['name'], $item['map']) && $carrier == $item['name']){
					$carrier_slug = $item['map'];
				}
			}
			$carrier = self::$settings->get_shipping_carrier_by_slug($carrier_slug);
			if (!$carrier_slug || !is_array( $carrier ) || empty( $carrier )){
				self::debug_log( 'Not found Woo Orders Tracking carrier' );
				return;
			}
			ob_start();
			var_dump('$carrier_slug : '.$carrier_slug);
			var_dump($carrier);
			self::debug_log( ob_get_clean() );
			$carrier_name    = ! empty( $carrier['display_name'] )? $carrier['display_name'] :($carrier['name'] ?? $carrier_slug);
			$carrier_url     = $carrier['url'] ?? '';
			$xml = $this->get_parsed_xml( $shipstation_xml );
			if ( ! $xml ) {
				self::debug_log( 'Cannot parse XML' );
				return;
			}
			if ( isset( $xml->OrderID ) && $order->get_id() != $xml->OrderID ) {
				$order = wc_get_order( $xml->OrderID);
			}
			if ( ! $order ) {
				self::debug_log( 'Cannot find order' );
				return;
			}
			$tracking_url = self::$settings->get_url_tracking( $carrier_url, $tracking_number, $carrier_slug, $order->get_shipping_postcode(), false, false, $order->get_id() );
			$manage_tracking = self::$settings->get_params( 'manage_tracking' );
			ob_start();
			var_dump('$manage_tracking : '.$manage_tracking);
			var_dump($tracking_url);
			var_dump(!empty($order->get_items()) && !empty($xml->Items) && $manage_tracking !== 'order_only');
			self::debug_log( ob_get_clean() );
			$is_new = $is_updated = false;
			$items = isset( $xml->Items ) ? $xml->Items : '';
			if (!empty($order->get_items()) &&$items && !empty($items->Item) && $manage_tracking !== 'order_only') {
				$carrier_type = $carrier['carrier_type'] ??'';
				$items = $items->Item;
				$is_new = $is_updated = 0;
				ob_start();
				var_dump('$items : ');
				var_dump($items);
				self::debug_log( ob_get_clean() );
				foreach ($items as $item) {
					$item_id =  wc_clean( intval($item->LineItemID ?? '0')) ;
					ob_start();
					var_dump('$item_id : ');
					var_dump($item_id);
					var_dump($item->LineItemID);
					var_dump( $item);
					self::debug_log( ob_get_clean() );
					if (!$item_id){
						continue;
					}
					$tracking_change       = true;
					$current_tracking_data = array(
						'tracking_number' => '',
						'carrier_slug'    => '',
						'carrier_url'     => '',
						'carrier_name'    => '',
						'carrier_type'    => '',
						'time'            => time(),
					);
					$item    = $order->get_item( $item_id );
					$order_item_id = $item->get_id();
					ob_start();
					var_dump('$item_id : '.$item_id);
					var_dump('$order_item_id : '.$order_item_id);
					self::debug_log( ob_get_clean() );
					$item_tracking_data = wc_get_order_item_meta( $order_item_id, '_vi_wot_order_item_tracking_data', true );
					$item_tracking_data = $item_tracking_data ? vi_wot_json_decode( $item_tracking_data ):'';
					if ( is_array($item_tracking_data) && !empty($item_tracking_data) ) {
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
						$is_new++;
					}
					if ($tracking_change){
						$is_updated++;
					}
					$current_tracking_data['tracking_number'] = $tracking_number;
					$current_tracking_data['carrier_slug']    = $carrier_slug;
					$current_tracking_data['carrier_url']     = $carrier_url;
					$current_tracking_data['carrier_name']    = $carrier_name;
					$current_tracking_data['carrier_type']    = $carrier_type;
					$item_tracking_data[] = $current_tracking_data;
					ob_start();
					var_dump('$item_tracking_data');
					var_dump($item_tracking_data);
					self::debug_log( ob_get_clean() );
					wc_update_order_item_meta( $order_item_id, '_vi_wot_order_item_tracking_data', vi_wot_json_encode( $item_tracking_data ) );
				}
			}else {
				if ($manage_tracking === 'items_only'){
					self::debug_log('item_id is required because "Manage tracking by" is currently set to "Order items only"');
					return;
				}
				$old_tracking_number  = $order->get_meta( '_wot_tracking_number', true );
				$old_tracking_carrier = $order->get_meta( '_wot_tracking_carrier', true );
				if ( ! $old_tracking_carrier && ! $old_tracking_number ) {
					$is_new = true;
				}
				if ( $tracking_number != $old_tracking_number || $carrier_slug !== $old_tracking_carrier ) {
					$is_updated = true;
					$order->update_meta_data( '_wot_tracking_number', $tracking_number );
					$order->update_meta_data( '_wot_tracking_carrier', $carrier_slug );
					$order->update_meta_data( '_wot_tracking_status', '' );
					$order->save_meta_data();
					$order->save();
					do_action( 'woo_orders_tracking_updated_order_tracking_data', $order->get_id(), $tracking_number, $carrier );
				}
			}
			if (self::$settings->get_params('shipstation_paypal_enable')){
				$paypal_added_trackings = $order->get_meta( 'vi_wot_paypal_added_tracking_numbers', true );
				$transID                = $order->get_transaction_id();
				$paypal_method          = $order->get_payment_method();if ( ! $paypal_added_trackings ) {
					$paypal_added_trackings = array();
				}
				if ( ! in_array( $tracking_number, $paypal_added_trackings ) && $transID && $paypal_method ) {
					$send_paypal = array(
						array(
							'trans_id'        => $transID,
							'carrier_name'    => $carrier_name,
							'tracking_number' => $tracking_number,
						)
					);
					$credentials = VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_PAYPAL::get_api_credentials( $paypal_method );
					if ( $credentials['id'] && $credentials['secret'] ) {
						$add_paypal = VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_PAYPAL::add_tracking_number( $credentials['id'], $credentials['secret'], $send_paypal, $credentials['sandbox'] );
						if (isset( $add_paypal['status'] ) && $add_paypal['status'] === 'success' ) {
							$paypal_added_trackings[] = $tracking_number;
							$order->update_meta_data( 'vi_wot_paypal_added_tracking_numbers', $paypal_added_trackings );
							$order->save_meta_data();
							$order->save();
							self::debug_log('Add tracking number to PayPal successfully');
						}elseif ( isset( $add_paypal['errors'] ) && is_array( $add_paypal['errors'] ) && count( $add_paypal['errors'] ) ) {
							$error_description = $add_paypal['data'];
							$error_code        = '';
							$error             = $add_paypal['errors'][0];
							if ( is_array( $error['details'] ) && count( $error['details'] ) ) {
								if ( ! empty( $error['details'][0]['value'] ) ) {
									if ( ! empty( $error['details'][0]['issue'] ) ) {
										$error_code = $error['details'][0]['issue'];
									}
									if ( ! empty( $error['details'][0]['description'] ) ) {
										$error_description = $error['details'][0]['description'];
									}
								}
							}
							ob_start();
							var_dump('Add tracking to Papal fail: '.$error_code);
							var_dump($error_description);
							self::debug_log(ob_get_clean());
						} else {
							ob_start();
							var_dump('Add tracking to Papal fail: ');
							var_dump($add_paypal['data']);
							self::debug_log(ob_get_clean());
						}
					}else{
						self::debug_log('PayPal payment method not supported or missing API credentials');
					}
				}
			}
			ob_start();
			var_dump('$is_updated');
			var_dump($is_updated);
			self::debug_log( ob_get_clean() );
			if ( !$is_updated ) {
				return;
			}
			if ( self::$settings->get_params('shipstation_send_email')) {
				$email_sent= VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_EMAIL::send_email( $order->get_id() );
				if ( $email_sent ) {
					self::debug_log('Sent email successfully');
				}else{
					self::debug_log('Sent email fail');
				}
			}
			/*Send SMS*/
			if ( self::$settings->get_params('shipstation_send_sms')) {
				VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_SMS::send_sms( $tracking_number, $carrier_name, $carrier_url, $tracking_url, $order, $response, $is_new );
				if ( isset($response['sms_status']) &&  $response['sms_status'] === 'success' ) {
					self::debug_log('Sent sms successfully');
				}else{
					self::debug_log('Sent sms fail');
				}
			}
		}
		private static function debug_log( $content ) {
			if ( self::$settings->get_params( 'shipstation_debug' ) ) {
				VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_LOG::wc_log( $content, 'shipstation-debug', 'debug' );
			}
		}
		private function get_parsed_xml($xml){
			if ( ! class_exists( 'WC_Safe_DOMDocument' ) ) {
				include_once ABSPATH.'wp-content/plugins/woocommerce-shipstation-integration/includes/api-requests/class-wc-safe-domdocument.php';
			}

			libxml_use_internal_errors( true );

			$dom     = new WC_Safe_DOMDocument();
			$success = $dom->loadXML( $xml );

			if ( ! $success ) {
				self::debug_log( 'wpcom_safe_simplexml_load_string(): Error loading XML string' );
				return false;
			}

			if ( isset( $dom->doctype ) ) {
				self::debug_log( 'wpcom_safe_simplexml_import_dom(): Unsafe DOCTYPE Detected' );
				return false;
			}

			return simplexml_import_dom( $dom, 'SimpleXMLElement' );
		}
	}
}
?>