<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class VI_WOOCOMMERCE_ORDERS_TRACKING_FRONTEND_ORDER_DETAILS {
	protected static $settings;

	public function __construct() {
		self::$settings = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_instance();
		add_action( 'wp_enqueue_scripts', array( $this, 'wp_enqueue_scripts' ) );
		add_filter( 'woocommerce_account_orders_columns', array( $this, 'woocommerce_account_orders_columns' ) );
		add_action( 'woocommerce_my_account_my_orders_column_woo-orders-tracking', array(
			$this,
			'add_track_button_on_my_account'
		) );
		add_action( 'woocommerce_order_details_before_order_table', array(
			$this,
			'woocommerce_order_details_before_order_table'
		) );
		add_action( 'woocommerce_order_details_after_order_table', array(
			$this,
			'woocommerce_order_details_after_order_table'
		) );
	}

	/**
	 * @param $order
	 */
	public function woocommerce_order_details_before_order_table( $order ) {
		if ( is_order_received_page() && self::$settings->get_params( 'default_track_info_number' )
		     && 'before_order_table' === self::$settings->get_params( 'default_track_info_position' )
		) {
			$this->add_default_tracking_number_for_new_order( $order );
		}
	}

	/**
	 * @param $order
	 */
	public function woocommerce_order_details_after_order_table( $order ) {
		if ( is_order_received_page() && self::$settings->get_params( 'default_track_info_number' )
		     && 'after_order_table' === self::$settings->get_params( 'default_track_info_position' )
		) {
			$this->add_default_tracking_number_for_new_order( $order );
		}
	}

	/**
	 * @param $order WC_Order
	 */

	public static function add_default_tracking_number_for_new_order( $order ) {
		if ( $order ) {
			$order_id = $order->get_id();
			if ( ! count( VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::search_order_item_by_tracking_number( '', $order_id, '' ) ) ) {
				$language = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_frontend_language();
				$content  = self::$settings->get_params( 'default_track_info_content', '', $language );
				if ( $content ) {
					$tracking_number   = VI_WOOCOMMERCE_ORDERS_TRACKING_FRONTEND_FRONTEND::generate_default_tracking_number( $order );
					$tracking_url_show = self::$settings->get_url_tracking( '', $tracking_number, '', '', false, true, $order_id );
					if ( $tracking_url_show ) {
						echo VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::wp_kses_post(str_replace( array( '{tracking_url}', '{tracking_number}' ), array( $tracking_url_show, $tracking_number ), $content ));// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
					}
				}
			}
		}
	}

	/**
	 * @param $args array
	 * @param $order WC_Order
	 *
	 * @throws Exception
	 */
	public function woocommerce_get_order_item_totals( $args, $order ) {
        if (!$order){
            return $args;
        }
		$tracking_number  = $order->get_meta( '_wot_tracking_number', true );
		$tracking_carrier = $order->get_meta( '_wot_tracking_carrier', true );
		if ( $tracking_number && $tracking_carrier) {
			$language = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_frontend_language();
			$email_woo_tracking_number_html  = self::$settings->get_params( 'email_woo_tracking_number_html', '', $language );
			$email_woo_tracking_carrier_html = self::$settings->get_params( 'email_woo_tracking_carrier_html', '', $language );
			$current_tracking_data = array(
				'tracking_number' => $tracking_number,
				'carrier_slug'    => $tracking_carrier,
				'carrier_url'     => '',
				'carrier_name'    => '',
				'carrier_type'    => '',
				'status'          => $order->get_meta( '_wot_tracking_status', true ),
				'time'            => time(),
			);
            ob_start();
			VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_WOO_ORDER_EMAIL::print_tracking_info($current_tracking_data,$order, $email_woo_tracking_number_html,$email_woo_tracking_carrier_html, true);
            $tracking_html = ob_get_clean();
			$args['viwot_tracking_info'] = [
				'label'=>esc_html__('Tracking',  'woocommerce-orders-tracking'),
				'value'=>$tracking_html,
			];
        }
        return $args;
	}
	/**
	 * @param $item_id
	 * @param $item
	 * @param $order WC_Order
	 *
	 * @throws Exception
	 */
	public function woocommerce_order_item_meta_end( $item_id, $item, $order ) {
		if ( $order ) {
			$language = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_frontend_language();
			VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_WOO_ORDER_EMAIL::include_tracking_info_after_order_item( $item_id, $order, false, true, $language );
		}
	}

	/**
	 *
	 */
	public function wp_enqueue_scripts() {
		global $post;
		$display = false;
		if ( is_account_page() ) {
			$display = true;
		} else {
			if ( $post && false !== strpos( $post->post_content, '[woocommerce_order_tracking]' ) ) {
				$display = true;
			}
			$display = apply_filters( 'woocommerce_orders_tracking_display_tracking_for_order_details', $display );
		}
		if ( $display ) {
			wp_enqueue_style( 'woo-orders-tracking-order-details', VI_WOOCOMMERCE_ORDERS_TRACKING_CSS . 'order-details.css', '', VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION );
			$css = '.woo-orders-tracking-tracking-number-container-delivered a{color:' . self::$settings->get_params( 'timeline_track_info_status_background_delivered' ) . '}';
			$css .= '.woo-orders-tracking-tracking-number-container-pickup a{color:' . self::$settings->get_params( 'timeline_track_info_status_background_pickup' ) . '}';
			$css .= '.woo-orders-tracking-tracking-number-container-transit a{color:' . self::$settings->get_params( 'timeline_track_info_status_background_transit' ) . '}';
			$css .= '.woo-orders-tracking-tracking-number-container-pending a{color:' . self::$settings->get_params( 'timeline_track_info_status_background_pending' ) . '}';
			$css .= '.woo-orders-tracking-tracking-number-container-alert a{color:' . self::$settings->get_params( 'timeline_track_info_status_background_alert' ) . '}';
			wp_add_inline_style( 'woo-orders-tracking-order-details', $css );
            if (self::$settings->get_params('manage_tracking') === 'order_only'){
                add_filter('woocommerce_get_order_item_totals', [$this,'woocommerce_get_order_item_totals'],10,2);
            }else {
	            /*Tracking info position uses the same hook if set to "After each order item" so remove it to avoid duplicated tracking info on customer's order details page*/
	            remove_action( 'woocommerce_order_item_meta_end', array(
		            'VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_WOO_ORDER_EMAIL',
		            'woocommerce_order_item_meta_end'
	            ) );
	            add_action( 'woocommerce_order_item_meta_end', array( $this, 'woocommerce_order_item_meta_end' ), 10, 3 );
            }
		}
	}

	public function woocommerce_account_orders_columns( $columns ) {
		if ( isset( $columns['order-actions'] ) ) {
			$order_action = $columns['order-actions'];
			unset( $columns['order-actions'] );
			$columns['woo-orders-tracking'] = __( 'Tracking', 'woocommerce-orders-tracking' );
			$columns['order-actions']       = $order_action;
		} else {
			$columns['woo-orders-tracking'] = __( 'Tracking', 'woocommerce-orders-tracking' );
		}

		return $columns;
	}

	/**
	 * @param $order WC_Order
	 *
	 * @throws Exception
	 */
	public function add_track_button_on_my_account( $order ) {
		$order_id   = $order->get_id();
		$line_items = $order->get_items();
		if ( count( $line_items ) ) {
			$tracking_list = array();
			?>
            <div class="<?php echo esc_attr( self::set( 'tracking-number-column-container' ) ) ?>">
				<?php
				$tracking_number  = $order->get_meta( '_wot_tracking_number', true );
				$tracking_carrier = $order->get_meta( '_wot_tracking_carrier', true );
				if ( self::$settings->get_params( 'manage_tracking' ) !== 'items_only' || ( $tracking_number && $tracking_carrier ) ) {
					$this->print_tracking_number( array(
						'tracking_number' => $tracking_number,
						'carrier_slug'    => $tracking_carrier,
						'carrier_url'     => '',
						'carrier_name'    => '',
						'carrier_type'    => '',
						'status'          => $order->get_meta( '_wot_tracking_status', true ),
						'time'            => time(),
					), '', $order_id, $order, $tracking_list );
				}
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
					$this->print_tracking_number( $current_tracking_data, $item_id, $order_id, $order, $tracking_list );
					$track_per_quantity = self::$settings->get_params( 'track_per_quantity' );
					if ( $track_per_quantity ) {
						$item_tracking_data = wc_get_order_item_meta( $item_id, '_vi_wot_order_item_tracking_data_by_quantity', true );
						if ( $item_tracking_data ) {
							$item_tracking_data = vi_wot_json_decode( $item_tracking_data );
                            foreach ($item_tracking_data as $current_tracking_data){
	                            $this->print_tracking_number( $current_tracking_data, $item_id, $order_id, $order, $tracking_list );
                            }
						}
					}
				}
				if ( ! count( $tracking_list ) && self::$settings->get_params( 'default_track_info_number' ) ) {
					if ( self::$settings->get_params( 'service_tracking_page' ) ) {
						$track_args = VI_WOOCOMMERCE_ORDERS_TRACKING_FRONTEND_FRONTEND::get_default_tracking_timeline( $order );
						if ( count( $track_args['tracking'] ) ) {
							$tracking_number   = VI_WOOCOMMERCE_ORDERS_TRACKING_FRONTEND_FRONTEND::generate_default_tracking_number( $order );
							$tracking_url_show = self::$settings->get_url_tracking( '', $tracking_number, '', '', false, true, $order_id );
							if ( $tracking_url_show ) {
								$container_class = array( 'tracking-number-container' );
								$title           = esc_attr__( 'Click to track', 'woocommerce-orders-tracking' );
								if ( $track_args['status'] ) {
									$container_class[] = 'tracking-number-container-' . $track_args['status'];
									$title             = sprintf( esc_attr__( 'Shipment status: %s', 'woocommerce-orders-tracking' ),// phpcs:ignore WordPress.WP.I18n.MissingTranslatorsComment
										self::$settings->get_status_text_by_service_carrier( $track_args['status'] ) );
								}
								?>
                                <div class="<?php echo esc_attr( self::set( $container_class ) ) ?>"
                                     title="<?php echo wp_kses_post($title) ?>">
                                    <a class="<?php echo esc_attr( self::set( 'tracking-number' ) ) ?>"
                                       href="<?php echo esc_url( $tracking_url_show ) ?>"
                                       target="_blank"><?php echo esc_html( $tracking_number ) ?></a>
                                </div>
								<?php
							}
						}
					}
				}
				?>
            </div>
			<?php
		}
	}

	protected static function set( $name, $set_name = false ) {
		return VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::set( $name, $set_name );
	}

	/**
	 * @param $current_tracking_data
	 * @param $item_id
	 * @param $order_id
	 * @param $order WC_Order
	 * @param $tracking_list
	 */
	protected function print_tracking_number( $current_tracking_data, $item_id, $order_id, $order, &$tracking_list ) {
		$tracking_number = apply_filters( 'vi_woo_orders_tracking_current_tracking_number', $current_tracking_data['tracking_number'], $item_id, $order_id );
		$carrier_url     = apply_filters( 'vi_woo_orders_tracking_current_tracking_url', $current_tracking_data['carrier_url'], $item_id, $order_id );
		$carrier_slug    = apply_filters( 'vi_woo_orders_tracking_current_carrier_slug', $current_tracking_data['carrier_slug'], $item_id, $order_id );
		$tracking_status = isset( $current_tracking_data['status'] ) ? VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::convert_status( $current_tracking_data['status'] ) : '';
		if ( $tracking_number && ! in_array( $tracking_number, $tracking_list ) ) {
			$tracking_list[] = $tracking_number;
			$carrier         = self::$settings->get_shipping_carrier_by_slug( $current_tracking_data['carrier_slug'] );
			if ( is_array( $carrier ) && count( $carrier ) ) {
				$carrier_url = $carrier['url'];
			}
			$tracking_url_show = apply_filters( 'vi_woo_orders_tracking_current_tracking_url_show',
				self::$settings->get_url_tracking( $carrier_url, $tracking_number, $carrier_slug, $order->get_shipping_postcode(), false, true, $order_id ), $item_id, $order_id );
			$container_class   = array( 'tracking-number-container' );
			$title             = esc_attr__( 'Click to track', 'woocommerce-orders-tracking' );
			if ( $tracking_status ) {
				$container_class[] = 'tracking-number-container-' . $tracking_status;
				$title             = sprintf( esc_attr__( 'Shipment status: %s', 'woocommerce-orders-tracking' ),// phpcs:ignore WordPress.WP.I18n.MissingTranslatorsComment
					self::$settings->get_status_text_by_service_carrier( $current_tracking_data['status'] ) );
			}
			?>
            <div class="<?php echo esc_attr( self::set( $container_class ) ) ?>"
                 title="<?php echo wp_kses_post($title) ?>">
                <a class="<?php echo esc_attr( self::set( 'tracking-number' ) ) ?>"
                   href="<?php echo esc_url( $tracking_url_show ) ?>"
                   target="_blank"><?php echo esc_html( $tracking_number ) ?></a>
            </div>
			<?php
		}
	}
}