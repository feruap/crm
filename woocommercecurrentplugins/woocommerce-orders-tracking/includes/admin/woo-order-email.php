<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_WOO_ORDER_EMAIL {
	protected static $settings;
	protected static $has_tracking_number;
	protected static $g_tracking;

	public function __construct() {
		self::$settings = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_instance();
		add_action( 'init', array(
			$this,
			'add_shortcode'
		) );
		if ( self::$settings->get_params( 'email_woo_enable' ) ) {
			$email_woo_position = self::$settings->get_params( 'email_woo_position' );
			switch ( $email_woo_position ) {
				case 'before_order_table':
					add_action( 'woocommerce_email_before_order_table', array(
						$this,
						'woocommerce_email_before_order_table'
					), 20, 4 );

					break;
				case 'after_order_item':
					add_action( 'woocommerce_order_item_meta_end', array(
						__CLASS__,
						'woocommerce_order_item_meta_end'
					), 10, 3 );

					break;
				case 'after_order_table':
				default:
					add_action( 'woocommerce_email_after_order_table', array(
						$this,
						'woocommerce_email_after_order_table'
					), 20, 4 );
			}
			add_action( 'woocommerce_email_after_order_table', array(
				$this,
				'add_default_tracking_number_in_email'
			), 20 );
		}
	}

	/**
	 * @param $order
	 * @param $sent_to_admin
	 * @param $plain_text
	 * @param $email
	 *
	 * @throws Exception
	 */
	public function woocommerce_email_before_order_table( $order, $sent_to_admin, $plain_text, $email ) {
		$email_woo_status = self::$settings->get_params( 'email_woo_status' );
		if ( ! $email || ( $email_woo_status && is_array( $email_woo_status ) && in_array( $email->id, $email_woo_status ) ) ) {
			$this->include_tracking_info( $order );
		}
	}

	/**
	 * @return false|string
	 * @throws Exception
	 */

	public function woocommerce_orders_tracking_info_woo_email() {
		$return = '';
        global $theorder;
        $order = $theorder ? wc_get_order($theorder) :'';
        if (!$order) {
	        global $post;
	        if ( $post && ! empty( $post->ID ) ) {
		        $order = wc_get_order( $post->ID );
	        }
        }
		if ( $order ) {
			ob_start();
			$this->include_tracking_info( $order );
			$return = ob_get_clean();
		}
		return $return;
	}

	public function add_shortcode() {
		add_shortcode( 'woocommerce_orders_tracking_info_woo_email', array(
			$this,
			'woocommerce_orders_tracking_info_woo_email'
		) );
	}

	/**
	 * @param $order
	 * @param $sent_to_admin
	 * @param $plain_text
	 * @param $email
	 *
	 * @throws Exception
	 */
	public function woocommerce_email_after_order_table( $order, $sent_to_admin, $plain_text, $email ) {
		$email_woo_status = self::$settings->get_params( 'email_woo_status' );
		if ( ! $email || ( $email_woo_status && is_array( $email_woo_status ) && in_array( $email->id, $email_woo_status ) ) ) {
			$this->include_tracking_info( $order );
		}
	}

	/**
	 * @param $order WC_Order
	 *
	 * @throws Exception
	 */
	public function include_tracking_info( $order ) {
		if ( $order ) {
			$order_id = $order->get_id();

            /* There some problem with email order when first time create not save metadata*/
            $order = wc_get_order( $order_id );

			$language = '';
			if ( is_plugin_active( 'sitepress-multilingual-cms/sitepress.php' ) ) {
				$language = $order->get_meta( 'wpml_language', true );
			}
			if ( ! $language && function_exists( 'pll_get_post_language' ) ) {
				$language = pll_get_post_language( $order_id );
			}
			$email_woo_html               = self::$settings->get_params( 'email_woo_html', '', $language );
			$email_woo_tracking_list_html = self::$settings->get_params( 'email_woo_tracking_list_html', '', $language );
			if ( $email_woo_html || $email_woo_tracking_list_html ) {
				$tracking_info    = array();
				$tracking_list    = array();
				$tracking_number  = $order->get_meta( '_wot_tracking_number', true );
				$tracking_carrier = $order->get_meta( '_wot_tracking_carrier', true );
				if ( self::$settings->get_params( 'manage_tracking' ) !== 'items_only' || ( $tracking_number && $tracking_carrier ) ) {
					$this->get_tracking_list( array(
						'tracking_number' => $tracking_number,
						'carrier_slug'    => $tracking_carrier,
						'carrier_url'     => '',
						'carrier_name'    => '',
						'carrier_type'    => '',
						'status'          => $order->get_meta( '_wot_tracking_status', true ),
						'time'            => time(),
					), $order, $email_woo_tracking_list_html, $tracking_info, $tracking_list );
				}
				foreach ( $order->get_items() as $item_id => $item ) {
					$item_tracking_data = wc_get_order_item_meta( $item_id, '_vi_wot_order_item_tracking_data', true );
					if ( $item_tracking_data ) {
						$item_tracking_data    = vi_wot_json_decode( $item_tracking_data );
						$current_tracking_data = array_pop( $item_tracking_data );
						$this->get_tracking_list( $current_tracking_data, $order, $email_woo_tracking_list_html, $tracking_info, $tracking_list );
					}
					$quantity = $item->get_quantity();
					if ( $quantity > 1 ) {
						$item_tracking_data = wc_get_order_item_meta( $item_id, '_vi_wot_order_item_tracking_data_by_quantity', true );
						if ( $item_tracking_data ) {
							$item_tracking_data = vi_wot_json_decode( $item_tracking_data );
							for ( $i = 0; $i < $quantity - 1; $i ++ ) {
								if ( isset( $item_tracking_data[ $i ] ) ) {
									$current_tracking_data = $item_tracking_data[ $i ];
									$this->get_tracking_list( $current_tracking_data, $order, $email_woo_tracking_list_html, $tracking_info, $tracking_list );
								}
							}
						}
					}
				}
				if ( count( $tracking_list ) ) {
					$email_woo_html = str_replace( '{tracking_list}', implode( ', ', $tracking_list ), $email_woo_html );
					if ( self::$g_tracking !== null ) {
						foreach ( self::$g_tracking as $key => $value ) {
							$email_woo_html = str_replace( "{{$key}}", $value, $email_woo_html );
						}
					}
					echo wp_kses_post( ent2ncr( $email_woo_html ) );
				} elseif ( self::$settings->get_params( 'default_track_info_number' ) ) {
					VI_WOOCOMMERCE_ORDERS_TRACKING_FRONTEND_ORDER_DETAILS::add_default_tracking_number_for_new_order( $order );
				}
			}
		}
	}

	/**
	 * @param $current_tracking_data
	 * @param $order WC_Order
	 * @param $email_woo_tracking_list_html
	 * @param $tracking_info
	 * @param $tracking_list
	 */
	protected function get_tracking_list( $current_tracking_data, $order, $email_woo_tracking_list_html, &$tracking_info, &$tracking_list ) {
		$carrier_id    = $current_tracking_data['carrier_slug'];
		$tracking_code = $current_tracking_data['tracking_number'];
		$carrier_url   = $current_tracking_data['carrier_url'];
		$carrier_name  = $current_tracking_data['carrier_name'];
		$display_name  = $carrier_name;
		$carrier       = self::$settings->get_shipping_carrier_by_slug( $carrier_id, '' );
		if ( is_array( $carrier ) && count( $carrier ) ) {
			$carrier_url  = $carrier['url'];
			$carrier_name = $carrier['name'];
			if ( ! empty( $carrier['display_name'] ) ) {
				$display_name = $carrier['display_name'];
			} else {
				$display_name = $carrier_name;
			}
		}
		$tracking_url = self::$settings->get_url_tracking( $carrier_url, $tracking_code, $carrier_id, $order->get_shipping_postcode(), false, false, $order->get_id() );
        if ( $tracking_code && $carrier_id && $tracking_url ) {
			if ( self::$g_tracking === null ) {
				self::$g_tracking = array(
					'tracking_number' => $tracking_code,
					'carrier_name'    => $display_name,
					'carrier_url'     => $carrier_url,
					'tracking_url'    => $tracking_url,
				);
			}
			$t = array(
				'tracking_code' => $tracking_code,
				'tracking_url'  => $tracking_url,
				'carrier_name'  => $display_name,
			);
			if ( ! in_array( $t, $tracking_info ) ) {
				$tracking_info[] = $t;
				$tracking_list[] = str_replace( array(
					'{tracking_number}',
					'{tracking_url}',
					'{carrier_name}',
					'{carrier_url}'
				), array(
					$tracking_code,
					esc_url( $tracking_url ),
					$display_name,
					esc_url( $carrier_url )
				), $email_woo_tracking_list_html );
			}
		}
	}

	/**
	 * @param $item_id
	 * @param $item
	 * @param $order WC_Order
	 *
	 * @throws Exception
	 */
	public static function woocommerce_order_item_meta_end( $item_id, $item, $order ) {
		if ( $order ) {
			$order_id = $order->get_id();
			$language = '';
			if ( is_plugin_active( 'sitepress-multilingual-cms/sitepress.php' ) ) {
				$language = $order->get_meta( 'wpml_language', true );
			}
			if ( ! $language && function_exists( 'pll_get_post_language' ) ) {
				$language = pll_get_post_language( $order_id );
			}
			self::include_tracking_info_after_order_item( $item_id, $order, false, false, $language );
		}
	}

	/**
	 * @param        $item_id
	 * @param        $order WC_Order
	 * @param        $plain_text
	 * @param bool   $add_nonce
	 * @param string $language
	 *
	 * @throws Exception
	 */
	public static function include_tracking_info_after_order_item( $item_id, $order, $plain_text = false, $add_nonce = false, $language = '' ) {
		if ( ! $plain_text ) {
			$order_id = $order->get_id();
			if ( self::$has_tracking_number === null ) {
				self::$has_tracking_number = 0;
			}
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
			if ( ! $current_tracking_data['tracking_number'] ) {
				$tracking_number  = $order->get_meta( '_wot_tracking_number', true );
				$tracking_carrier = $order->get_meta( '_wot_tracking_carrier', true );
				if ( self::$settings->get_params( 'manage_tracking' ) !== 'items_only' || ( $tracking_number && $tracking_carrier ) ) {
					$current_tracking_data = array(
						'tracking_number' => $tracking_number,
						'carrier_slug'    => $tracking_carrier,
						'carrier_url'     => '',
						'carrier_name'    => '',
						'carrier_type'    => '',
						'status'          => $order->get_meta( '_wot_tracking_status', true ),
						'time'            => time(),
					);
				}
			}
			$email_woo_tracking_number_html  = self::$settings->get_params( 'email_woo_tracking_number_html', '', $language );
			$email_woo_tracking_carrier_html = self::$settings->get_params( 'email_woo_tracking_carrier_html', '', $language );
			self::print_tracking_info( $current_tracking_data, $order, $email_woo_tracking_number_html, $email_woo_tracking_carrier_html, $add_nonce );
			$line_item = $order->get_item( $item_id );
			if ( $line_item ) {
				$track_per_quantity = self::$settings->get_params( 'track_per_quantity' );
				if ( $track_per_quantity  ) {
					$item_tracking_data = wc_get_order_item_meta( $item_id, '_vi_wot_order_item_tracking_data_by_quantity', true );
					$item_tracking_data = $item_tracking_data ? vi_wot_json_decode( $item_tracking_data ) : array();
					if ( is_array($item_tracking_data) ) {
                        foreach ($item_tracking_data as $current_tracking_data){
	                        self::print_tracking_info( $current_tracking_data, $order, $email_woo_tracking_number_html, $email_woo_tracking_carrier_html, $add_nonce );
                        }
					}
				}
			}
		}
	}

	/**
	 * @param $current_tracking_data
	 * @param $order WC_Order
	 * @param $email_woo_tracking_number_html
	 * @param $email_woo_tracking_carrier_html
	 * @param $add_nonce
	 */
	public static function print_tracking_info( $current_tracking_data, $order, $email_woo_tracking_number_html, $email_woo_tracking_carrier_html, $add_nonce ) {
		$carrier_id      = $current_tracking_data['carrier_slug'];
		$tracking_code   = $current_tracking_data['tracking_number'];
		$carrier_url     = $current_tracking_data['carrier_url'];
		$carrier_name    = $current_tracking_data['carrier_name'];
		$tracking_status = isset( $current_tracking_data['status'] ) ? VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::convert_status( $current_tracking_data['status'] ) : '';
		$display_name    = $carrier_name;
		$carrier         = self::$settings->get_shipping_carrier_by_slug( $carrier_id, '' );
		if ( is_array( $carrier ) && count( $carrier ) ) {
			$carrier_url  = $carrier['url'];
			$carrier_name = $carrier['name'];
			if ( ! empty( $carrier['display_name'] ) ) {
				$display_name = $carrier['display_name'];
			} else {
				$display_name = $carrier_name;
			}
		}
		$tracking_url = self::$settings->get_url_tracking( $carrier_url, $tracking_code, $carrier_id, $order->get_shipping_postcode(), false, $add_nonce, $order->get_id() );
		$carrier_url  = str_replace( array(
			'{tracking_number}',
			'{postal_code}'
		), '', $carrier_url );
		if ( $tracking_code && $tracking_url ) {
			self::$has_tracking_number ++;
			?>
            <div class="<?php echo esc_attr( VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::set( 'orders-details' ) ) ?>">
                <div class="<?php echo esc_attr( VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::set( array(
					'orders-details-tracking-number',
					'tracking-number-container-' . $tracking_status
				) ) ) ?>">
					<?php echo wp_kses_post(str_replace( array(
						'{tracking_number}',
						'{tracking_url}',
						'{carrier_name}',
						'{carrier_url}'
					), array(
						$tracking_code,
						esc_url( $tracking_url ),
						$display_name,
						esc_url( $carrier_url )
					), $email_woo_tracking_number_html )) ?>
                </div>
                <div class="<?php echo esc_attr( VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::set( 'orders-details-tracking-carrier' ) ) ?>">
					<?php echo wp_kses_post(str_replace( array(
						'{tracking_number}',
						'{tracking_url}',
						'{carrier_name}',
						'{carrier_url}'
					), array(
						$tracking_code,
						esc_url( $tracking_url ),
						$display_name,
						esc_url( $carrier_url )
					), $email_woo_tracking_carrier_html )) ?>
                </div>
            </div>
			<?php
		}
	}

	public function add_default_tracking_number_in_email( $order ) {
		if ( self::$has_tracking_number === 0 && self::$settings->get_params( 'default_track_info_number' ) ) {
			VI_WOOCOMMERCE_ORDERS_TRACKING_FRONTEND_ORDER_DETAILS::add_default_tracking_number_for_new_order( $order );
		}
	}
}