<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
/**
 * WooCommerce Email Template Customizer
 */
if ( ! class_exists( 'VI_WOOCOMMERCE_ORDERS_TRACKING_PLUGINS_WooCommerce_Email_Template_Customizer' ) ) {
	class VI_WOOCOMMERCE_ORDERS_TRACKING_PLUGINS_WooCommerce_Email_Template_Customizer {
		protected static $settings;

		public function __construct() {
			self::$settings = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_instance();
			add_action( 'admin_enqueue_scripts', array(
				$this,
				'admin_enqueue_scripts'
			) );
			add_filter( 'viwec_register_email_type', array( $this, 'register_email_type' ) );
			add_filter( 'viwec_sample_subjects', array( $this, 'register_email_sample_subject' ) );
			add_filter( 'viwec_sample_templates', array( $this, 'register_email_sample_template' ) );
			add_filter( 'viwec_live_edit_shortcodes', array( $this, 'register_render_preview_shortcode' ) );
//			add_filter( 'viwec_register_preview_shortcode', array( $this, 'register_render_preview_shortcode' ) );
			add_action( 'viwec_render_content', array( $this, 'render_track_info' ), 10, 3 );
			add_filter( 'viwec_register_replace_shortcode', array(
				$this,
				'replace_shortcodes_for_other_email_types'
			), 10, 3 );

			add_filter( 'viwec_register_preview_shortcode', array(
				$this,
				'replace_shortcodes_for_other_email_types_preview'
			), 20, 2 );
		}

		/**
		 * @param $shortcodes
		 * @param $object WC_Order
		 *
		 * @return mixed
		 * @throws Exception
		 */
		public function replace_shortcodes_for_other_email_types_preview( $shortcodes, $object ) {
			$this->replace_shortcodes( $shortcodes, $object );

			return $shortcodes;
		}

		/**
		 * @param $shortcodes
		 * @param $object WC_Order
		 * @param $args
		 *
		 * @return mixed
		 * @throws Exception
		 */
		public function replace_shortcodes_for_other_email_types( $shortcodes, $object, $args ) {
			$this->replace_shortcodes( $shortcodes, $object );

			return $shortcodes;
		}

		/**
		 * @param $shortcodes
		 * @param $object WC_Order
		 *
		 * @throws Exception
		 */
		public function replace_shortcodes( &$shortcodes, $object ) {
			global $woo_orders_tracking_items;
			$g_tracking = array(
				'order_id'           => '',
				'order_number'       => '',
				'billing_first_name' => '',
				'billing_last_name'  => '',
				'tracking_number'    => '',
				'carrier_name'       => '',
				'carrier_url'        => '',
				'tracking_url'       => '',
			);

			if ( $object && is_a( $object, 'WC_Order' ) ) {
				$order_id                         = $object->get_id();
				$g_tracking['order_id']           = $order_id;
				$g_tracking['order_number']       = $object->get_order_number();
				$g_tracking['billing_first_name'] = $object->get_billing_first_name();
				$g_tracking['billing_last_name']  = $object->get_billing_last_name();
				if ( is_array( $woo_orders_tracking_items ) && count( $woo_orders_tracking_items ) ) {
					$g_tracking['tracking_number'] = $woo_orders_tracking_items[0]['tracking_number'];
					$g_tracking['carrier_name']    = $woo_orders_tracking_items[0]['carrier_name'];
					$g_tracking['carrier_url']     = $woo_orders_tracking_items[0]['carrier_url'];
					$g_tracking['tracking_url']    = $woo_orders_tracking_items[0]['tracking_url'];
				} else {
					$line_items = $object->get_items();
					if ( count( $line_items ) ) {
						foreach ( $line_items as $item_id => $line_item ) {
							$item_tracking_data = wc_get_order_item_meta( $item_id, '_vi_wot_order_item_tracking_data', true );
							if ( $item_tracking_data ) {
								$item_tracking_data    = vi_wot_json_decode( $item_tracking_data );
								$current_tracking_data = array_pop( $item_tracking_data );
								$tracking_number       = $current_tracking_data['tracking_number'];
								if ( $tracking_number ) {
									$carrier_slug = $current_tracking_data['carrier_slug'];
									$carrier_url  = $current_tracking_data['carrier_url'];
									$carrier_name = $current_tracking_data['carrier_name'];
									$display_name = $carrier_name;
									$carrier      = self::$settings->get_shipping_carrier_by_slug( $carrier_slug, '' );
									if ( is_array( $carrier ) && count( $carrier ) ) {
										$carrier_url  = $carrier['url'];
										$carrier_name = $carrier['name'];
										$display_name = empty( $carrier['display_name'] ) ? $carrier_name : $carrier['display_name'];
									}
									$tracking_url_show             = apply_filters( 'vi_woo_orders_tracking_current_tracking_url_show', self::$settings->get_url_tracking( $carrier_url, $tracking_number, $carrier_slug, $object->get_shipping_postcode(), false, false, $order_id ), $item_id, $order_id );
									$carrier_url_show              = str_replace( array(
										'{tracking_number}',
										'{postal_code}'
									), '', $carrier_url );
									$g_tracking['tracking_number'] = $tracking_number;
									$g_tracking['carrier_name']    = $display_name;
									$g_tracking['carrier_url']     = $carrier_url_show;
									$g_tracking['tracking_url']    = $tracking_url_show;
									break;
								}
							}
						}
					}
				}
			}
			foreach ( $g_tracking as $key => $value ) {
				$shortcodes[] = array(
					"{wot_{$key}}" => $value
				);
			}
		}

		public function register_email_type( $emails ) {
			$emails['wot_email'] = array(
				'name'            => esc_html__( 'WooCommerce Orders Tracking email', 'woocommerce-orders-tracking' ),
				'hide_rules'      => array( 'country', 'category', 'products', 'min_order', 'max_order' ),
				'accept_elements' => array(
					'wot_tracking_table',
					'html/order_detail',
					'html/order_subtotal',
					'html/order_total',
					'html/total',
					'html/shipping_method',
					'html/payment_method',
					'html/billing_address',
					'html/shipping_address',
					'html/order_items',
					'html/order_note',
					'html/subtotal',
				),
			);

			return $emails;
		}

		public function register_email_sample_subject( $subjects ) {
			$subjects['wot_email'] = 'Your tracking number update';

			return $subjects;
		}

		public function register_email_sample_template( $samples ) {
			$samples['wot_email'] = [
				'basic' => [
					'name' => esc_html__( 'Basic', 'woocommerce-orders-tracking' ),
					'data' => '{"style_container":{"background-color":"transparent","background-image":"none"},"rows":{"0":{"props":{"style_outer":{"padding":"15px 35px","background-image":"none","background-color":"#162447","border-color":"transparent","border-style":"solid","border-width":"0px","border-radius":"0px","width":"600px"},"type":"layout/grid1cols","dataCols":"1"},"cols":{"0":{"props":{"style":{"padding":"0px","background-image":"none","background-color":"transparent","border-color":"#444444","border-style":"solid","border-width":"0px","border-radius":"0px","width":"530px"}},"elements":{"0":{"type":"html/text","style":{"width":"530px","line-height":"30px","background-image":"none","padding":"0px","border-color":"#444444","border-style":"solid","border-width":"0px","border-radius":"0px"},"content":{"text":"<p style=\"text-align: center;\"><span style=\"color: #ffffff;\">{site_title}</span></p>"},"attrs":{},"childStyle":{}}}}}},"1":{"props":{"style_outer":{"padding":"25px","background-image":"none","background-color":"#f9f9f9","border-color":"#444444","border-style":"solid","border-width":"0px","border-radius":"0px","width":"600px"},"type":"layout/grid1cols","dataCols":"1"},"cols":{"0":{"props":{"style":{"padding":"0px","background-image":"none","background-color":"transparent","border-color":"#444444","border-style":"solid","border-width":"0px","border-radius":"0px","width":"550px"}},"elements":{"0":{"type":"html/text","style":{"width":"550px","line-height":"28px","background-image":"none","padding":"0px","border-color":"#444444","border-style":"solid","border-width":"0px","border-radius":"0px"},"content":{"text":"<p style=\"text-align: center;\"><span style=\"font-size: 24px; color: #444444;\">Update about your order #{wot_order_id}</span></p>"},"attrs":{},"childStyle":{}}}}}},"2":{"props":{"style_outer":{"padding":"10px 35px","background-image":"none","background-color":"#ffffff","border-color":"#444444","border-style":"solid","border-width":"0px","border-radius":"0px","width":"600px"},"type":"layout/grid1cols","dataCols":"1"},"cols":{"0":{"props":{"style":{"padding":"0px","background-image":"none","background-color":"transparent","border-color":"#444444","border-style":"solid","border-width":"0px","border-radius":"0px","width":"530px"}},"elements":{"0":{"type":"html/text","style":{"width":"530px","line-height":"22px","background-image":"none","padding":"0px","border-color":"#444444","border-style":"solid","border-width":"0px","border-radius":"0px"},"content":{"text":"<p>Dear {wot_billing_first_name},</p>"},"attrs":{},"childStyle":{}},"1":{"type":"html/text","style":{"width":"530px","line-height":"22px","background-image":"none","padding":"0px","border-color":"#444444","border-style":"solid","border-width":"0px","border-radius":"0px"},"content":{"text":"<p>Your order #{wot_order_id} has been updated as below:</p>"},"attrs":{},"childStyle":{}},"2":{"type":"html/spacer","style":{"width":"530px"},"content":{},"attrs":{},"childStyle":{".viwec-spacer":{"padding":"10px 0px 0px"}}},"3":{"type":"html/spacer","style":{"width":"530px"},"content":{},"attrs":{},"childStyle":{".viwec-spacer":{"padding":"10px 0px 0px"}}},"4":{"type":"wot_tracking_table","style":{"width":"530px"},"content":{"tracking_number_col":"{wot_tracking_number}","carrier_name_col":"{wot_carrier_name}","tracking_url_col":"<a target=\"_blank\" href=\"{wot_tracking_url}\">Track</a>"},"attrs":{},"childStyle":{".viwec-tracking-table":{"font-size":"15px","color":"#100e0e","line-height":"22px"}}},"5":{"type":"html/text","style":{"width":"530px","line-height":"22px","background-image":"none","padding":"10px 0px","border-color":"#444444","border-style":"solid","border-width":"0px","border-radius":"0px"},"content":{"text":"<p>Yours sincerely!</p>\n<p>{site_title}</p>"},"attrs":{},"childStyle":{}}}}}},"3":{"props":{"style_outer":{"padding":"25px 35px","background-image":"none","background-color":"#162447","border-color":"#444444","border-style":"solid","border-width":"0px","border-radius":"0px","width":"600px"},"type":"layout/grid1cols","dataCols":"1"},"cols":{"0":{"props":{"style":{"padding":"0px","background-image":"none","background-color":"transparent","border-color":"#444444","border-style":"solid","border-width":"0px","border-radius":"0px","width":"530px"}},"elements":{"0":{"type":"html/text","style":{"width":"530px","line-height":"22px","background-image":"none","padding":"0px","border-color":"#444444","border-style":"solid","border-width":"0px","border-radius":"0px"},"content":{"text":"<p style=\"text-align: center;\"><span style=\"color: #f5f5f5; font-size: 20px;\">Get in Touch</span></p>"},"attrs":{},"childStyle":{}},"1":{"type":"html/text","style":{"width":"530px","line-height":"22px","background-image":"none","padding":"20px 0px","border-color":"#444444","border-style":"solid","border-width":"0px","border-radius":"0px"},"content":{"text":"<p style=\"text-align: center;\"><span style=\"color: #f5f5f5; font-size: 12px;\">This email was sent by : <span style=\"color: #ffffff;\"><a style=\"color: #ffffff;\" href=\"{admin_email}\">{admin_email}</a></span></span></p>\n<p style=\"text-align: center;\"><span style=\"color: #f5f5f5; font-size: 12px;\">For any questions please send an email to <span style=\"color: #ffffff;\"><a style=\"color: #ffffff;\" href=\"{admin_email}\">{admin_email}</a></span></span></p>"},"attrs":{},"childStyle":{}},"2":{"type":"html/text","style":{"width":"530px","line-height":"22px","background-image":"none","padding":"0px","border-color":"#444444","border-style":"solid","border-width":"0px","border-radius":"0px"},"content":{"text":"<p style=\"text-align: center;\"><span style=\"color: #f5f5f5;\"><span style=\"color: #f5f5f5;\"><span style=\"font-size: 12px;\"><a style=\"color: #f5f5f5;\" href=\"#\">Privacy Policy</a>&nbsp; |&nbsp; <a style=\"color: #f5f5f5;\" href=\"#\">Help Center</a></span></span></span></p>"},"attrs":{},"childStyle":{}}}}}}}}'
				]
			];

			return $samples;
		}

		public function register_render_preview_shortcode( $sc ) {
			$sc['wot_email'] = self::shortcodes_list();

			return $sc;
		}

		public static function shortcodes_list() {
			return array(
				'{wot_order_id}'           => '12345',
				'{wot_order_number}'       => '12345',
				'{wot_billing_first_name}' => 'John',
				'{wot_billing_last_name}'  => 'Doe',
				'{wot_tracking_number}'    => 'TRACKINGNUMBER',
				'{wot_tracking_url}'       => self::$settings->get_url_tracking( 'https://tools.usps.com/go/TrackConfirmAction_input?qtc_tLabels1={tracking_number}', 'TRACKINGNUMBER', 'usps', '', false, true, '12345' ),
				'{wot_carrier_name}'       => 'USPS',
				'{wot_carrier_url}'        => 'https://www.usps.com/',
			);
		}

		public function admin_enqueue_scripts() {
			global $pagenow, $post_type, $viwec_params;
			if ( ( $pagenow === 'post.php' || $pagenow === 'post-new.php' ) && $post_type === 'viwec_template' && $viwec_params !== null ) {
				wp_enqueue_script( 'woocommerce-orders-tracking-email-template-customizer', VI_WOOCOMMERCE_ORDERS_TRACKING_JS . 'woocommerce-email-template-customizer.js', array(
					'jquery',
					'woocommerce-email-template-customizer-components'
				), VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION, false );
				wp_enqueue_style( 'woocommerce-orders-tracking-email-template-customizer-style', VI_WOOCOMMERCE_ORDERS_TRACKING_CSS . 'woocommerce-email-template-customizer.css', '', VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION );
				wp_localize_script( 'woocommerce-orders-tracking-email-template-customizer', 'viwec_woocommerce_orders_tracking', array(
					'category' => 'woocommerce_orders_tracking_email',
					'type'     => 'wot_tracking_table',
					'name'     => esc_html__( 'Orders Tracking', 'woocommerce-orders-tracking' ),
					'icon'     => 'woocommerce-orders-tracking',
					'html'     => $this->get_items_html(),
				) );
			}
		}

		public function get_items_html() {
			global $viwec_params;
			ob_start();
			?>
            <div class="viwec-woocommerce-orders-tracking">
                <table class="viwec-tracking-table" width="100%" align="center"
                       style="text-align: center;border-collapse:collapse;line-height: 22px" border="0"
                       cellpadding="0"
                       cellspacing="0">
                    <tr>
                        <th class="viwec-text-product"
                            style=" border:1px solid #dddddd; text-align: center; padding: 10px"><?php esc_html_e( 'Product title', 'woocommerce-orders-tracking' ) ?></th>
                        <th class="viwec-text-tracking-number"
                            style=" border:1px solid #dddddd; text-align: center; padding: 10px"><?php esc_html_e( 'Tracking number', 'woocommerce-orders-tracking' ) ?></th>
                        <th class="viwec-text-carrier-name"
                            style=" border:1px solid #dddddd; text-align: center; padding: 10px"><?php esc_html_e( 'Carrier name', 'woocommerce-orders-tracking' ) ?></th>
                        <th class="viwec-text-tracking-url"
                            style=" border:1px solid #dddddd; text-align: center; padding: 10px"><?php esc_html_e( 'Tracking url', 'woocommerce-orders-tracking' ) ?></th>
                    </tr>
                    <tr>
                        <td class="viwec-p-name" style=" border:1px solid #dddddd; text-align: left; padding: 10px">
                            Sample product
                        </td>
                        <td style=" border:1px solid #dddddd; text-align: center; padding: 10px"
                            class="viwec-text-tracking-number">
                            <div class="viwec-text-tracking-number-col">{wot_tracking_number}</div>
                        </td>
                        <td style=" border:1px solid #dddddd; text-align: center; padding: 10px"
                            class="viwec-text-carrier-name">
                            <div class="viwec-text-carrier-name-col">{wot_carrier_name}</div>
                        </td>
                        <td style=" border:1px solid #dddddd; text-align: center; padding: 10px"
                            class="viwec-text-tracking-url">
                            <div class="viwec-text-tracking-url-col"><a target="_blank"
                                                                        href="{wot_tracking_url}"><?php esc_html_e( 'Track', 'woocommerce-orders-tracking' ) ?></a>
                            </div>
                        </td>
                    </tr>
                </table>
            </div>
			<?php
			$html = ob_get_clean();

			return $html;
		}

		public function render_track_info( $type, $props, $render ) {
			if ( $type !== 'wot_tracking_table' ) {
				return;
			}
			global $woo_orders_tracking_items;
			if ( ! empty( $render->preview ) ) {
				if ( ! empty( $render->order ) ) {
					$woo_orders_tracking_items = array();
					$order                     = $render->order;
					$line_items                = $order->get_items();
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
						if ( $item_tracking_data ) {
							$item_tracking_data    = vi_wot_json_decode( $item_tracking_data );
							$current_tracking_data = array_pop( $item_tracking_data );
						}
						$woo_orders_tracking_items[] = array(
							'order_item_name' => $line_item->get_name(),
							'tracking_number' => $current_tracking_data['tracking_number'],
							'carrier_name'    => $current_tracking_data['carrier_name'],
							'carrier_url'     => str_replace( array(
								'{tracking_number}',
								'{postal_code}'
							), '', $current_tracking_data['carrier_url'] ),
							'tracking_url'    => self::$settings->get_url_tracking( $current_tracking_data['carrier_url'], $current_tracking_data['tracking_number'], '', '', false, true, '12345' ),
						);

						$quantity = $line_item->get_quantity();
						if ( $quantity > 1 ) {
							$item_tracking_data = wc_get_order_item_meta( $item_id, '_vi_wot_order_item_tracking_data_by_quantity', true );
							if ( $item_tracking_data ) {
								$item_tracking_data = vi_wot_json_decode( $item_tracking_data );
								for ( $i = 0; $i < $quantity - 1; $i ++ ) {
									if ( isset( $item_tracking_data[ $i ] ) ) {
										$current_tracking_data       = $item_tracking_data[ $i ];
										$woo_orders_tracking_items[] = array(
											'order_item_name' => $line_item->get_name(),
											'tracking_number' => $current_tracking_data['tracking_number'],
											'carrier_name'    => $current_tracking_data['carrier_name'],
											'carrier_url'     => str_replace( array(
												'{tracking_number}',
												'{postal_code}'
											), '', $current_tracking_data['carrier_url'] ),
											'tracking_url'    => self::$settings->get_url_tracking( $current_tracking_data['carrier_url'], $current_tracking_data['tracking_number'], '', '', false, true, '12345' ),
										);

									}
								}
							}
						}
					}
				}
				if ( count( $woo_orders_tracking_items ) ) {
					echo VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::wp_kses_post( $this->html_format_item( $props, $woo_orders_tracking_items ) );// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
				} else {
					$arg = array(
						'order_item_name' => 'Sample product',
						'tracking_number' => 'TRACKINGNUMBER',
						'carrier_name'    => 'USPS',
						'carrier_url'     => 'https://tools.usps.com/go/TrackConfirmAction_input',
						'tracking_url'    => self::$settings->get_url_tracking( 'https://tools.usps.com/go/TrackConfirmAction_input?qtc_tLabels1={tracking_number}', 'TRACKINGNUMBER', 'usps', '', false, true, '12345' ),
					);
					echo VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::wp_kses_post( $this->html_format_item( $props, $arg ) );// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
				}

				return;
			}
			echo VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::wp_kses_post( $this->html_format_item( $props, $woo_orders_tracking_items ) );// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped

		}

		public function html_format_item( $props, $items ) {
			ob_start();
			$text_style          = ! empty( $props['childStyle']['.viwec-tracking-table'] ) ? viwec_parse_styles( $props['childStyle']['.viwec-tracking-table'] ) : '';
			$tracking_number_col = ! empty( $props['content']['tracking_number_col'] ) ? $props['content']['tracking_number_col'] : '';
			$carrier_name_col    = ! empty( $props['content']['carrier_name_col'] ) ? $props['content']['carrier_name_col'] : '';
			$tracking_url_col    = ! empty( $props['content']['tracking_url_col'] ) ? $props['content']['tracking_url_col'] : '';
			?>
            <table width='100%%' border='0' cellpadding='0' cellspacing='0' align='center'
                   style=' border-collapse:separate;font-size: 0;'>
                <tr>
                    <td valign='middle'>
                        <table class="viwec-tracking-table" width="100%%" align="center"
                               style="text-align: center;border-collapse:collapse;<?php echo esc_attr( $text_style ) ?>"
                               border="0"
                               cellpadding="0"
                               cellspacing="0">
                            <tr>
                                <th class="viwec-text-product"
                                    style=" border:1px solid #dddddd; text-align: center; padding: 10px"><?php esc_html_e( 'Product title', 'woocommerce-orders-tracking' ) ?></th>
								<?php
								if ( $tracking_number_col ) {
									?>
                                    <th class="viwec-text-tracking-number"
                                        style=" border:1px solid #dddddd; text-align: center; padding: 10px"><?php esc_html_e( 'Tracking number', 'woocommerce-orders-tracking' ) ?></th>
									<?php
								}
								if ( $carrier_name_col ) {
									?>
                                    <th class="viwec-text-carrier-name"
                                        style=" border:1px solid #dddddd; text-align: center; padding: 10px"><?php esc_html_e( 'Carrier name', 'woocommerce-orders-tracking' ) ?></th>
									<?php
								}
								if ( $tracking_url_col ) {
									?>
                                    <th class="viwec-text-tracking-url"
                                        style=" border:1px solid #dddddd; text-align: center; padding: 10px"><?php esc_html_e( 'Tracking url', 'woocommerce-orders-tracking' ) ?></th>
									<?php
								}
								?>
                            </tr>
							<?php
							foreach ( $items as $item ) {
								?>
                                <tr>
                                    <td class="viwec-p-name"
                                        style=" border:1px solid #dddddd; text-align: left; padding: 10px"><?php echo wp_kses_post( $item['order_item_name'] ) ?></td>
									<?php
									if ( $tracking_number_col ) {
										?>
                                        <td style=" border:1px solid #dddddd; text-align: center; padding: 10px"
                                            class="viwec-text-tracking-number">
											<?php
											if ( $item['tracking_number'] ) {
												?>
                                                <div class="viwec-text-tracking-number-col"><?php echo wp_kses_post( str_replace( array(
														'{wot_tracking_number}',
														'{wot_carrier_name}',
														'{wot_carrier_url}',
														'{wot_tracking_url}'
													), array(
														$item['tracking_number'],
														$item['carrier_name'],
														$item['carrier_url'],
														$item['tracking_url']
													), $tracking_number_col ) ) ?></div>
												<?php
											}
											?>

                                        </td>
										<?php
									}
									if ( $carrier_name_col ) {
										?>
                                        <td style=" border:1px solid #dddddd; text-align: center; padding: 10px"
                                            class="viwec-text-carrier-name">
											<?php
											if ( $item['tracking_number'] ) {
												?>
                                                <div class="viwec-text-carrier-name-col"><?php echo wp_kses_post( str_replace( array(
														'{wot_tracking_number}',
														'{wot_carrier_name}',
														'{wot_carrier_url}',
														'{wot_tracking_url}'
													), array(
														$item['tracking_number'],
														$item['carrier_name'],
														$item['carrier_url'],
														$item['tracking_url']
													), $carrier_name_col ) ) ?></div>
												<?php
											}
											?>

                                        </td>
										<?php
									}
									if ( $tracking_url_col ) {
										?>
                                        <td style=" border:1px solid #dddddd; text-align: center; padding: 10px"
                                            class="viwec-text-tracking-url">
											<?php
											if ( $item['tracking_number'] ) {
												?>
                                                <div class="viwec-text-tracking-url-col"><?php echo wp_kses_post( str_replace( array(
														'{wot_tracking_number}',
														'{wot_carrier_name}',
														'{wot_carrier_url}',
														'{wot_tracking_url}'
													), array(
														$item['tracking_number'],
														$item['carrier_name'],
														$item['carrier_url'],
														$item['tracking_url']
													), $tracking_url_col ) ) ?></div>
												<?php
											}
											?>

                                        </td>
										<?php
									}
									?>
                                </tr>
								<?php
							}
							?>

                        </table>
                    </td>
                </tr>
            </table>
			<?php
			return ob_get_clean();
		}
	}
}
