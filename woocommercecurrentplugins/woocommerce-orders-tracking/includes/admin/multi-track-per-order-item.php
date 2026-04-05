<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_MULTI_TRACK_PER_ORDER_ITEM {
	protected static $settings;

	public function __construct() {
		self::$settings = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_instance();
		/*Deactivate the original custom plugin(Manage Tracking At Item Quantity Level) and notify the customer that it's now integrated to the core plugin*/
		add_action( 'plugins_loaded', array(
			$this,
			'plugins_loaded'
		) );
		add_action(
			'after_plugin_row_villatheme-manage-tracking-at-item-quantity-level/villatheme-manage-tracking-at-item-quantity-level.php', array(
			$this,
			'deprecated_message'
		), 10, 3 );
		add_action( 'admin_print_styles', array( $this, 'admin_print_styles' ) );

		add_filter( 'vi_woo_orders_tracking_single_edit_is_tracking_change', array(
			$this,
			'tracking_change'
		), 10, 6 );
		add_action( 'woocommerce_after_order_itemmeta', array(
			$this,
			'woocommerce_after_order_itemmeta'
		), 20, 3 );
		add_action( 'vi_woo_orders_tracking_single_edit_save_tracking_data', array(
			$this,
			'save_tracking_data'
		), 10, 4 );
	}

	/**
	 *
	 */
	public function admin_print_styles() {
		?>
        <style>
            tr[data-slug="manage-tracking-at-item-quantity-level"] th,
            tr[data-slug="manage-tracking-at-item-quantity-level"] td {
                border-bottom: 0 !important;
                box-shadow: none !important;
            }
        </style>
		<?php
	}

	/**
	 * Show message below plugin row
	 *
	 * @param $plugin_file
	 * @param $plugin_data
	 * @param $status
	 */
	public function deprecated_message( $plugin_file, $plugin_data, $status ) {
		$wp_list_table = _get_list_table( 'WP_Plugins_List_Table' );
		?>
        <tr class="plugin-update-tr">
            <td colspan="<?php echo esc_attr($wp_list_table->get_column_count()); ?>" class="plugin-update colspanchange">
                <div class="update-message inline notice notice-error notice-alt">
                    <p><?php echo VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::wp_kses_post( sprintf( __( 'This plugin is deactivated as its feature was integrated to <strong>WooCommerce Orders Tracking</strong> plugin since version 1.1.0, you can safely delete this custom plugin.',// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
							'woocommerce-orders-tracking' ) ) ) ?></p>
                </div>
            </td>
        </tr>
		<?php
	}

	/**
	 * If the custom plugin is active, deactivate it and enable the new option
	 */
	public function plugins_loaded() {
		$plugin = 'villatheme-manage-tracking-at-item-quantity-level/villatheme-manage-tracking-at-item-quantity-level.php';
		if ( is_plugin_active( $plugin ) ) {
			$params                       = self::$settings->get_params();
			$params['track_per_quantity'] = 1;
			update_option( 'woo_orders_tracking_settings', $params );
			deactivate_plugins( $plugin );
		}
	}

	/**
	 * Filter the tracking change status when saving a tracking number
	 *
	 * @param $tracking_change
	 * @param $quantity_index
	 * @param $tracking_number
	 * @param $carrier_slug
	 * @param $item_id
	 * @param $order_id
	 *
	 * @return bool
	 */
	public function tracking_change( $tracking_change, $quantity_index, $tracking_number, $carrier_slug, $item_id, $order_id ) {
		$order = wc_get_order( $order_id );
		if ( $order ) {
			$item = $order->get_item( $item_id );
			if ( $item ) {
				$quantity = $item->get_quantity();
				$manage_tracking    = self::$settings->get_params( 'manage_tracking' );
				$track_per_quantity = self::$settings->get_params( 'track_per_quantity' );
                $check = true;
                if ($manage_tracking === 'order_only' || !$track_per_quantity ||
                    ($track_per_quantity !== 'unlimited' && (1> $quantity_index || $quantity_index > $quantity))){
                    $check = false;
                }
                if (!$check){
	                return $tracking_change;
                }
				$adjust_quantity_index = $quantity_index - 2;
				$item_tracking_data    = $item->get_meta( '_vi_wot_order_item_tracking_data_by_quantity', true );
				if ( $item_tracking_data ) {
					$item_tracking_data = vi_wot_json_decode( $item_tracking_data );
				} else {
					$item_tracking_data = array();
				}
				if ( isset( $item_tracking_data[ $adjust_quantity_index ] ) ) {
					$current_tracking_data = $item_tracking_data[ $adjust_quantity_index ];
					if ( $tracking_number != $current_tracking_data['tracking_number'] || $carrier_slug !== $current_tracking_data['carrier_slug'] ) {
						$tracking_change = true;
					}
				} else {
					$tracking_change = true;
				}
			}
		}

		return $tracking_change;
	}

	/**
	 * @param $current_tracking_data
	 * @param $quantity_index
	 * @param $item_id
	 * @param $order_id
	 *
	 * @throws Exception
	 */
	public function save_tracking_data( $current_tracking_data, $quantity_index, $item_id, $order_id ) {
		$order = wc_get_order( $order_id );
		if ( $order ) {
			$item = $order->get_item( $item_id );
			if ( $item ) {
				$quantity = $item->get_quantity();
				$manage_tracking    = self::$settings->get_params( 'manage_tracking' );
				$track_per_quantity = self::$settings->get_params( 'track_per_quantity' );
				if (!apply_filters('vi_woo_orders_tracking_show_multi_tracking_of_order_item', $manage_tracking !== 'order_only' && $track_per_quantity)){
					return;
				}
				$adjust_quantity_index = $quantity_index - 2;
				$item_tracking_data    = $item->get_meta( '_vi_wot_order_item_tracking_data_by_quantity', true );
				if ( $item_tracking_data ) {
					$item_tracking_data = vi_wot_json_decode( $item_tracking_data );
				} else {
					$item_tracking_data = array();
				}
                if ($track_per_quantity){
	                $item_tracking_data[ $adjust_quantity_index ] = $current_tracking_data;
                }elseif ( 1 < $quantity_index && $quantity_index <= $quantity ) {
					for ( $i = 0; $i < $quantity - 1; $i ++ ) {
						if ( ! isset( $item_tracking_data[ $i ] ) ) {
							$item_tracking_data[ $i ] = array(
								'tracking_number' => '',
								'carrier_slug'    => '',
								'carrier_url'     => '',
								'carrier_name'    => '',
								'carrier_type'    => '',
								'time'            => time(),
							);
						}
					}
					$item_tracking_data[ $adjust_quantity_index ] = $current_tracking_data;
				}
				wc_update_order_item_meta( $item_id, '_vi_wot_order_item_tracking_data_by_quantity', wp_json_encode( $item_tracking_data ) );
			}
		}
	}

	private static function set( $name, $set_name = false ) {
		return VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::set( $name, $set_name );
	}

	/**
	 * @param $item_id
	 * @param $item WC_Order_Item
	 * @param $product
	 */
	public function woocommerce_after_order_itemmeta( $item_id, $item, $product ) {
		if ( is_ajax() || ! is_a( $item, 'WC_Order_Item_Product' ) ) {
			return;
		}
		$order_id = $item->get_order_id();
		$order    = wc_get_order( $order_id );
        if (!$order){
            return;
        }
		$transID       = $order->get_transaction_id();
		$paypal_method = $order->get_payment_method();
		$quantity      = $item->get_quantity();
		$manage_tracking    = self::$settings->get_params( 'manage_tracking' );
		$track_per_quantity = self::$settings->get_params( 'track_per_quantity' );
        if (!apply_filters('vi_woo_orders_tracking_show_multi_tracking_of_order_item', $manage_tracking !== 'order_only' && $track_per_quantity)){
            return;
        }
		$item_tracking_data = $item->get_meta( '_vi_wot_order_item_tracking_data_by_quantity', true );
		if ( $item_tracking_data ) {
			$item_tracking_data = vi_wot_json_decode( $item_tracking_data );
		} else {
			$item_tracking_data = array();
		}
        if ($track_per_quantity ==='unlimited'){
	        $i = 0;
            foreach ($item_tracking_data as $current_tracking_data){
	            $this->tracking_item_html($current_tracking_data, 0 ,$i+2,$paypal_method,$transID,$item_id,$item,$order_id,$order);
	            $i++;
            }
//	        $item_tracking_count = count($item_tracking_data);
//            if ($item_tracking_count){
//                for ($i = 0; $i < $item_tracking_count - 1; $i++){
//	                if ( empty( $item_tracking_data[ $i ] ) ) {
//                        continue;
//	                }
//	                $current_tracking_data = $item_tracking_data[ $i ];
//	                $this->tracking_item_html($current_tracking_data, 0 ,$i+2,$paypal_method,$transID,$item_id,$item,$order_id,$order);
//                }
//            }
            ?>
            <p>
                <span class="<?php echo esc_attr( self::set( 'item-add-new-tracking' ) ) ?>"
                  data-order_id="<?php echo esc_attr( $order_id ) ?>"
                  data-item_id="<?php echo esc_attr( $item_id ) ?>"
                  title="<?php esc_html_e('Add new tracking','woocommerce-orders-tracking' ); ?>">
                <span class="dashicons dashicons-plus-alt2"></span>
                </span>
            </p>
            <?php
        }elseif ($quantity > 1){
	        for ( $i = 0; $i < $quantity - 1; $i ++ ) {
		        if ( isset( $item_tracking_data[ $i ] ) ) {
			        $current_tracking_data = $item_tracking_data[ $i ];
		        } else {
			        $current_tracking_data = array(
				        'tracking_number' => '',
				        'carrier_slug'    => '',
				        'carrier_url'     => '',
				        'carrier_name'    => '',
				        'carrier_type'    => '',
				        'time'            => time(),
			        );
		        }
		        $this->tracking_item_html($current_tracking_data, 1 ,$i+2,$paypal_method,$transID,$item_id,$item,$order_id,$order);
	        }
        }
	}
	/**
	 * @param $item_di
	 * @param $order_id
	 * @param $order WC_Order
	 * @param $item WC_Order_Item
	 * @param $show_current_tracking
	 * @param $current_tracking_data
	 * @param $transID
	 * @param $quantity_index
	 * @param $paypal_method
	 */
    public function tracking_item_html($current_tracking_data,$show_current_tracking,$quantity_index,$paypal_method,$transID,$item_id,$item,$order_id,$order){
	    $tracking_number = apply_filters( 'vi_woo_orders_tracking_current_tracking_number', $current_tracking_data['tracking_number'], $item_id, $order_id );
	    $carrier_slug    = apply_filters( 'vi_woo_orders_tracking_current_carrier_slug', $current_tracking_data['carrier_slug'], $item_id, $order_id );
	    if ( !apply_filters( 'vi_woo_orders_tracking_show_tracking_of_order_item_by_quantity',$show_current_tracking || $tracking_number || $carrier_slug, $item_id, $order_id )
	    ) {
            return;
	    }
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
                     title="<?php printf( esc_attr__( 'Tracking carrier %s', 'woocommerce-orders-tracking' ), esc_attr( $carrier_name ) )// phpcs:ignore WordPress.WP.I18n.MissingTranslatorsComment ?>">
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
                                      data-quantity_index="<?php echo esc_attr( $quantity_index) ?>"
                                      title="<?php echo esc_attr__( 'Edit tracking', 'woocommerce-orders-tracking' ) ?>"></span>
				    <?php
				    if ( $transID && in_array( $paypal_method, self::$settings->get_params( 'supported_paypal_gateways' ) ) ) {
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
                              data-order_id="<?php echo esc_attr( $order_id ) ?>">
                                                <img class="<?php echo esc_attr( self::set( 'item-tracking-button-add-to-paypal' ) ) ?>"
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