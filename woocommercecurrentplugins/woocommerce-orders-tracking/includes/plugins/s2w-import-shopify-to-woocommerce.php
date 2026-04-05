<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
/**
 * S2W - Add shopify order tracking
 */
if ( ! class_exists( 'VI_WOOCOMMERCE_ORDERS_TRACKING_PLUGINS_S2W_IMPORT_SHOPIFY_TO_WOOCOMMERCE' ) ) {
	class VI_WOOCOMMERCE_ORDERS_TRACKING_PLUGINS_S2W_IMPORT_SHOPIFY_TO_WOOCOMMERCE {
		protected static $settings;
		protected static $shopify_shipping_default;

		public function __construct() {
			if ( ! is_plugin_active( 's2w-import-shopify-to-woocommerce/s2w-import-shopify-to-woocommerce.php' ) ) {
				return;
			}
			self::$settings                 = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_instance();
			self::$shopify_shipping_default = json_decode( '[{"slug":"4px","name":"4PX"},{"slug":"xpedigo","name":"Xpedigo"},{"slug":"royalmail","name":"Royal Mail"},{"slug":"ups","name":"UPS"},{"slug":"canadapost","name":"Canada Post"},{"slug":"chinapost","name":"China Post"},{"slug":"fedex","name":"FedEx"},{"slug":"postnorddk","name":"PostNord DK"},{"slug":"postnordse","name":"PostNord SE"},{"slug":"postnordno","name":"PostNord NO"},{"slug":"usps","name":"USPS"},{"slug":"dhlexpress","name":"DHL Express"},{"slug":"dhlecommerce","name":"DHL eCommerce"},{"slug":"dhlecommerceasia","name":"DHL eCommerce Asia"},{"slug":"eagle","name":"Eagle"},{"slug":"purolator","name":"Purolator"},{"slug":"australiapost","name":"Australia Post"},{"slug":"newzealandpost","name":"New Zealand Post"},{"slug":"correios","name":"Correios"},{"slug":"laposte","name":"La Poste"},{"slug":"tnt","name":"TNT"},{"slug":"ontrac","name":"OnTrac"},{"slug":"whistl","name":"Whistl"},{"slug":"apc","name":"APC"},{"slug":"fsc","name":"FSC"},{"slug":"gls","name":"GLS"},{"slug":"asendiausa","name":"Asendia USA"},{"slug":"amazonlogisticsus","name":"Amazon Logistics US"},{"slug":"amazonlogisticsuk","name":"Amazon Logistics UK"},{"slug":"japanposten","name":"Japan Post (EN)"},{"slug":"japanpostja","name":"Japan Post (JA)"},{"slug":"sagawaen","name":"Sagawa (EN)"},{"slug":"sagawaja","name":"Sagawa (JA)"},{"slug":"singaporepost","name":"Singapore Post"},{"slug":"yamatoen","name":"Yamato (EN)"},{"slug":"yamatoja","name":"Yamato (JA)"},{"slug":"dpd","name":"DPD"},{"slug":"dpduk","name":"DPD UK"},{"slug":"dpdlocal","name":"DPD Local"},{"slug":"pitneybowes","name":"Pitney Bowes"},{"slug":"sfexpress","name":"SF Express"},{"slug":"southwestaircargo","name":"Southwest Air Cargo"},{"slug":"postnl","name":"PostNL"},{"slug":"yunexpress","name":"YunExpress"},{"slug":"chukou1","name":"Chukou1"},{"slug":"anjunlogistics","name":"Anjun Logistics"},{"slug":"sfcfulfillment","name":"SFC Fulfillment"},{"slug":"canparcanada","name":"Canpar Canada"},{"slug":"sendle","name":"Sendle"},{"slug":"tollipec","name":"Toll IPEC"},{"slug":"startrack","name":"StarTrack"},{"slug":"evri","name":"Evri"},{"slug":"colissimo","name":"Colissimo"},{"slug":"posteitaliane","name":"Poste Italiane"},{"slug":"doordash","name":"DoorDash"},{"slug":"deutschepost","name":"Deutsche Post"},{"slug":"mondialrelay","name":"Mondial Relay"},{"slug":"comingle","name":"Comingle"},{"slug":"correos","name":"Correos"},{"slug":"bpost","name":"BPost"},{"slug":"bpostinternational","name":"BPost International"},{"slug":"ctt","name":"CTT"},{"slug":"cttexpress","name":"CTT Express"},{"slug":"swisspost","name":"Swiss Post"},{"slug":"icelandpost","name":"Iceland Post"},{"slug":"cypruspost","name":"Cyprus Post"},{"slug":"israelpost","name":"Israel Post"},{"slug":"anpost","name":"An Post"},{"slug":"latviapost","name":"Latvia Post"},{"slug":"lietuvospastas","name":"Lietuvos Pa\u0161tas"},{"slug":"ninjavan","name":"NinjaVan"},{"slug":"dx","name":"DX"},{"slug":"ags","name":"AGS"},{"slug":"xpologistics","name":"XPO Logistics"},{"slug":"chronopost","name":"Chronopost"},{"slug":"packeta","name":"Packeta"},{"slug":"estes","name":"Estes"},{"slug":"lasership","name":"Lasership"},{"slug":"qxpress","name":"Qxpress"},{"slug":"idex","name":"IDEX"},{"slug":"coordinadora","name":"Coordinadora"},{"slug":"dtdexpress","name":"DTD Express"},{"slug":"heppnerinternationalespeditiongmbhco","name":"Heppner Internationale Spedition GmbH & Co."},{"slug":"logisters","name":"Logisters"},{"slug":"meteorspace","name":"Meteor Space"},{"slug":"pingandatengfeiexpress","name":"Ping An Da Tengfei Express"},{"slug":"yifanexpress","name":"YiFan Express"},{"slug":"royalshipments","name":"Royal Shipments"},{"slug":"shreenandancourier","name":"SHREE NANDAN COURIER"},{"slug":"venipak","name":"Venipak"},{"slug":"wmyc","name":"WMYC"},{"slug":"tinghao","name":"Tinghao"},{"slug":"wepost","name":"We Post"},{"slug":"delnext","name":"Delnext"},{"slug":"pagologistics","name":"Pago Logistics"},{"slug":"m3logistics","name":"M3 Logistics"},{"slug":"bonshaw","name":"Bonshaw"},{"slug":"wizmo","name":"Wizmo"},{"slug":"portalpostnord","name":"Portal PostNord"},{"slug":"guangdongweisuyiinformationtechnologywse","name":"Guangdong Weisuyi Information Technology (WSE)"},{"slug":"firstgloballogistics","name":"First Global Logistics"},{"slug":"qyunexpress","name":"Qyun Express"},{"slug":"firstline","name":"First Line"},{"slug":"fulfilla","name":"Fulfilla"},{"slug":"northrussiasupplychainshenzhenco","name":"North Russia Supply Chain (Shenzhen) Co."},{"slug":"stepforwardfreight","name":"Step Forward Freight"},{"slug":"tforcefinalmile","name":"TForce Final Mile"},{"slug":"lonestarovernight","name":"Lone Star Overnight"},{"slug":"uniteddeliveryservice","name":"United Delivery Service"},{"slug":"cdllastmile","name":"CDL Last Mile"},{"slug":"upscanada","name":"UPS Canada"},{"slug":"axlehire","name":"AxleHire"},{"slug":"bettertrucks","name":"Better Trucks"},{"slug":"fastwaysouthafrica","name":"Fastway South Africa"},{"slug":"dhlglobalmailasia","name":"DHL Global Mail Asia"},{"slug":"postnlinternational3s","name":"PostNL International 3S"},{"slug":"chinaems","name":"China EMS"},{"slug":"postnlinternational","name":"PostNL International"},{"slug":"parcelforce","name":"Parcel Force"},{"slug":"tntuk","name":"TNT UK"},{"slug":"canparusa","name":"Canpar USA"},{"slug":"aramexnewzealand","name":"Aramex New Zealand"},{"slug":"tntreference","name":"TNT Reference"},{"slug":"tntukreference","name":"TNT UK Reference"},{"slug":"dpdgermany","name":"DPD Germany"},{"slug":"landmarkglobal","name":"Landmark Global"},{"slug":"chitchats","name":"Chit Chats"},{"slug":"landmarkglobalreference","name":"Landmark Global Reference"},{"slug":"apgecommercesolutionsltd","name":"APG eCommerce Solutions Ltd."},{"slug":"99minutos","name":"99 Minutos"},{"slug":"andreani","name":"ANDREANI"},{"slug":"arubapost","name":"Aruba Post"},{"slug":"cevalogistics","name":"CEVA logistics"},{"slug":"dhlsweden","name":"DHL Sweden"},{"slug":"dpdbelgium","name":"DPD Belgium"},{"slug":"laposteburkinafaso","name":"La Poste Burkina Faso"},{"slug":"libyapost","name":"Libya Post"},{"slug":"maldivespost","name":"Maldives Post"},{"slug":"mauritiuspost","name":"Mauritius Post"},{"slug":"opt-nc","name":"OPT-NC"},{"slug":"servientregaecuador","name":"Servientrega Ecuador"},{"slug":"surpost","name":"Surpost"},{"slug":"telepost","name":"Tele Post"},{"slug":"ydh","name":"YDH"},{"slug":"emons","name":"Emons"},{"slug":"ammspedition","name":"Amm Spedition"},{"slug":"spee-deedeliveryservice","name":"Spee-Dee Delivery Service"},{"slug":"xyylogistics","name":"XYY Logistics"},{"slug":"yyzlogistics","name":"YYZ Logistics"},{"slug":"aeronet","name":"Aeronet"},{"slug":"borderexpress","name":"Border Express"},{"slug":"noxgermany","name":"NOX Germany"},{"slug":"cdek","name":"CDEK"},{"slug":"caribou","name":"Caribou"},{"slug":"smartcat","name":"SmartCat"},{"slug":"cargoexpresogt","name":"Cargo Expreso GT"},{"slug":"cargoexpresosv","name":"Cargo Expreso SV"},{"slug":"moovin","name":"moovin"},{"slug":"interparcel","name":"Interparcel"},{"slug":"aslcanada","name":"ASL Canada"},{"slug":"sprinter","name":"Sprinter"},{"slug":"ncs","name":"NCS"},{"slug":"hrparcel","name":"HR Parcel"},{"slug":"gplogisticservice","name":"GP Logistic Service"},{"slug":"deprisa","name":"Deprisa"},{"slug":"passport","name":"Passport"},{"slug":"fleetoptics","name":"Fleet Optics"},{"slug":"deliverit","name":"Deliver It"},{"slug":"appleexpress","name":"Apple Express"},{"slug":"dimercoexpressgroup","name":"Dimerco Express Group"},{"slug":"swishipde","name":"Swiship DE"},{"slug":"dpdhungary","name":"DPD Hungary"},{"slug":"wepickup","name":"We Pick Up"},{"slug":"myteamge","name":"MyTeamGE"}]', true );
			add_filter( 'woo_orders_tracking_update_settings_args', array( $this, 'woo_orders_tracking_update_settings_args' ), 10, 1 );
			add_filter( 'vi_wot_tab_menu', array( $this, 'add_tab_menu' ), 10, 1 );
			add_action( 'vi_wot_tab_settings', array( $this, 'add_settings' ) );
			add_action( 's2w_update_fulfillment', array( $this, 'add_tracking' ), 10, 2 );
		}

		public function add_tab_menu( $tabs ) {
			$tabs['s2w_order_tracking'] = esc_html__( 'S2W', 'woocommerce-orders-tracking' );

			return $tabs;
		}

		public function woo_orders_tracking_update_settings_args( $args ) {
			if ( ! isset( $_REQUEST['_vi_wot_setting_nonce'] ) || ! wp_verify_nonce( $_REQUEST['_vi_wot_setting_nonce'], 'vi_wot_setting_action_nonce' ) ) {
				return $args;
			}
			$args['s2w_order_tracking_enable']          = isset( $_POST['s2w_order_tracking_enable'] ) ? sanitize_text_field( wp_unslash( $_POST['s2w_order_tracking_enable'] ) ) : '';
			$args['s2w_order_tracking_send_email']      = isset( $_POST['s2w_order_tracking_send_email'] ) ? sanitize_text_field( wp_unslash( $_POST['s2w_order_tracking_send_email'] ) ) : '';
			$args['s2w_order_tracking_courier_mapping'] = isset( $_POST['s2w_order_tracking_courier_mapping'] ) ? wc_clean( wp_unslash( $_POST['s2w_order_tracking_courier_mapping'] ) ) : array();
			$args['s2w_order_tracking_debug']           = isset( $_POST['s2w_order_tracking_debug'] ) ? sanitize_text_field( wp_unslash( $_POST['s2w_order_tracking_debug'] ) ) : '';

			return $args;
		}

		public function add_settings() {
			self::$settings = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_instance( true );
			?>
            <div class="vi-ui bottom attached tab segment" data-tab="s2w_order_tracking">
                <table class="form-table">
                    <tbody>
                    <tr>
                        <th>
                            <label for="s2w_order_tracking_enable"><?php esc_html_e( 'Enable', 'woocommerce-orders-tracking' ) ?></label>
                        </th>
                        <td>
                            <div class="vi-ui toggle checkbox">
                                <input type="checkbox" name="s2w_order_tracking_enable" id="s2w_order_tracking_enable"
                                       value="1" <?php checked( self::$settings->get_params( 's2w_order_tracking_enable' ), '1' ) ?>><label></label>
                            </div>
                            <p><?php esc_html_e( 'Enable this to sync tracking numbers with \'S2W - Import Shopify to WooCommerce Premium\' plugin whenever you sync Order from Shopify to your store', 'woocommerce-orders-tracking' ) ?></p>
                        </td>
                    </tr>
                    <tr>
                        <th>
                            <label for="s2w_order_tracking_send_email"><?php esc_html_e( 'Send email', 'woocommerce-orders-tracking' ) ?></label>
                        </th>
                        <td>
                            <div class="vi-ui toggle checkbox">
                                <input type="checkbox" name="s2w_order_tracking_send_email" id="s2w_order_tracking_send_email"
                                       value="1" <?php checked( self::$settings->get_params( 's2w_order_tracking_send_email' ), '1' ) ?>><label></label>
                            </div>
                            <p class="description">
								<?php esc_html_e( 'When tracking numbers are synced with S2w, send an email to customers if tracking info changes', 'woocommerce-orders-tracking' ) ?>
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <th>
                            <label for="s2w_order_tracking_debug"><?php esc_html_e( 'Debug', 'woocommerce-orders-tracking' ) ?></label>
                        </th>
                        <td>
                            <div class="vi-ui toggle checkbox">
                                <input type="checkbox" name="s2w_order_tracking_debug" id="s2w_order_tracking_debug"
                                       value="1" <?php checked( self::$settings->get_params( 's2w_order_tracking_debug' ), '1' ) ?>><label></label>
                            </div>
                            <p class="description">
								<?php esc_html_e( 'If enabled, The errors will be logged.', 'woocommerce-orders-tracking' ); ?>
                            </p>
                        </td>
                    </tr>
                    </tbody>
                </table>
                <div class="vi-ui positive tiny message">
                    <div class="header"><?php esc_html_e( 'Carriers mapping', 'woocommerce-orders-tracking' ); ?></div>
                    <ul class="list">
                        <li><?php esc_html_e( 'Please save first to load all shipping carriers.', 'woocommerce-orders-tracking' ); ?></li>
                    </ul>
                </div>
                <table class="vi-ui celled table vi-wot-s2w_order_tracking-carriers-mapping">
                    <thead>
                    <tr>
                        <th><?php esc_html_e( 'Shopify shipping carrier', 'woocommerce-orders-tracking' ); ?></th>
                        <th><?php esc_html_e( 'Woo Orders Tracking carrier', 'woocommerce-orders-tracking' ); ?></th>
                    </tr>
                    </thead>
                    <tbody>
					<?php
					$courier_mapping = self::$settings->get_params( 's2w_order_tracking_courier_mapping' );
					$carriers        = self::$settings::get_carriers();
					if ( $courier_mapping === false ) {
						foreach ( self::$shopify_shipping_default as $item_shipping ) {
							$current_map = [
								'name' => $item_shipping['name']
							];
							foreach ( $carriers as $wot_item ) {
								if ( trim( strtolower( $wot_item['name'] ) ) == trim( strtolower( $item_shipping['name'] ) ) ) {
									$current_map['map'] = $wot_item['slug'];
								}
							}
							$courier_mapping[] = $current_map;
						}
					}

					if ( is_array( $courier_mapping ) && count( $courier_mapping ) ) {

						foreach ( $courier_mapping as $k => $item ) {
							?>
                            <tr class="vi-wot-s2w_order_tracking-carrie-mapping">
                                <td>
                                    <input type="text" name="s2w_order_tracking_courier_mapping[<?php echo esc_attr( $k ) ?>][name]"
                                           value="<?php echo esc_attr( $item['name'] ?? '' ) ?>">
                                </td>
                                <td>
                                    <select name="s2w_order_tracking_courier_mapping[<?php echo esc_attr( $k ) ?>][map]"
                                            class="vi-ui fluid search dropdown vi-wot-s2w_order_tracking-mapping-carrier">
                                        <option value=""></option>
										<?php
										foreach ( $carriers as $carrier ) {
											if ( ! isset( $carrier['slug'], $carrier['name'] ) ) {
												continue;
											}
											?>
                                            <option value="<?php echo esc_attr( $carrier['slug'] ) ?>" <?php selected( $item['map'] ?? '', $carrier['slug'] ) ?>><?php echo esc_html( $carrier['name'] ) ?></option>
											<?php
										}
										?>
                                    </select>
                                </td>
                            </tr>
							<?php
						}
					}
					?>
                    </tbody>
                </table>
                <span class="button vi-wot-s2w_order_tracking-add-carrier"><?php esc_html_e( 'Add ShipStation carrier', 'woocommerce-orders-tracking' ); ?></span>
				<?php
				do_action( 'woo_orders_tracking_settings_s2w_order_tracking' );
				?>
            </div>
			<?php
		}

		/**
		 * @param $order WC_Order
		 * @param $params array
		 *
		 * @throws Exception
		 */
		public function add_tracking( $order, $params ) {
			if ( ! self::$settings->get_params( 's2w_order_tracking_enable' ) || ! $order || ! $order->get_id() || empty( $params ) ) {
				return;
			}


			if ( ! $order ) {
				self::debug_log( 'Cannot find order' );

				return;
			}
			$order_line_item_data = [];
			if ( ! empty( $order->get_items() ) ) {

				$items = $order->get_items();

				foreach ( $items as $item ) {
					if ( ! $item ) {
						self::debug_log( 'not found $order_item' );
						continue;
					}
					$order_line_item_data[] = [
						'item_id'    => $item->get_id(),
						'item_title' => $item->get_name()
					];
				}
			}
			foreach ( $params as $param ) {
				$carrier = $param['carrier'] ?? '';
				$title   = $param['title'] ?? '';
				if ( ! $carrier ) {
					self::debug_log( 'Not found information to add tracking' );

					return;
				}


				$courier_mapping = self::$settings->get_params( 's2w_order_tracking_courier_mapping' );
				$carrier_slug    = '';
				foreach ( $courier_mapping as $item ) {
					if ( isset( $item['name'], $item['map'] ) && $carrier == $item['name'] ) {
						$carrier_slug = $item['map'];
					}
				}
				$carrier = self::$settings->get_shipping_carrier_by_slug( $carrier_slug );

				if ( ! $carrier_slug || ! is_array( $carrier ) || empty( $carrier ) ) {
					self::debug_log( 'Not found Woo Orders Tracking carrier' );

					return;
				}
				$carrier_type = $carrier['carrier_type'] ?? '';

				$carrier_name = ! empty( $carrier['display_name'] ) ? $carrier['display_name'] : ( $carrier['name'] ?? $carrier_slug );
				$carrier_url  = $carrier['url'] ?? '';


				$tracking_numbers = $param['tracking_numbers'] ?? [];
				foreach ( $order_line_item_data as $order_line_item ) {
					if ( trim( strtolower( $title ) ) == trim( strtolower( $order_line_item['item_title'] ) ) ) {
						$item_id            = $order_line_item['item_id'];
						$item_tracking_data = [];

						foreach ( $tracking_numbers as $tracking_number ) {

							$current_tracking_data = array(
								'tracking_number' => '',
								'carrier_slug'    => '',
								'carrier_url'     => '',
								'carrier_name'    => '',
								'carrier_type'    => '',
								'time'            => time(),
							);

							$current_tracking_data['tracking_number'] = $tracking_number;
							$current_tracking_data['carrier_slug']    = $carrier_slug;
							$current_tracking_data['carrier_url']     = $carrier_url;
							$current_tracking_data['carrier_name']    = $carrier_name;
							$current_tracking_data['carrier_type']    = $carrier_type;
							$item_tracking_data[]                     = $current_tracking_data;

						}
						$order_item_data = $order->get_item( $item_id );
						$order_item_data->update_meta_data( '_vi_wot_order_item_tracking_data_by_quantity', vi_wot_json_encode( $item_tracking_data ) );

						$order_item_data->save();
					}
				}


			}
//			die();
			if ( self::$settings->get_params( 's2w_order_tracking_send_email' ) ) {
				$email_sent = VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_EMAIL::send_email( $order->get_id() );
				if ( $email_sent ) {
					self::debug_log( 'Sent email successfully' );
				} else {
					self::debug_log( 'Sent email fail' );
				}
			}


		}

		private static function debug_log( $content ) {
			if ( self::$settings->get_params( 's2w_order_tracking_debug' ) ) {
				VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_LOG::wc_log( $content, 's2w_order_tracking-debug', 'debug' );
			}
		}


	}
}
?>