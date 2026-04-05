<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_EMAIL {
	protected static $settings;
	protected static $default_tracking = array();

	public function __construct() {
		self::$settings = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_instance();
	}

	/**
	 * @param       $order_id
	 * @param array $updated_items
	 * @param bool  $update_scheduled_emails
	 *
	 * @return bool
	 * @throws Exception
	 */
	public static function send_email( $order_id, $updated_items = array(), $update_scheduled_emails = false ) {
		global $woo_orders_tracking_items;
		$woo_orders_tracking_items = $updated_items;
		$g_tracking                = array(
			'tracking_number' => '',
			'carrier_name'    => '',
			'carrier_url'     => '',
			'tracking_url'    => '',
		);
		$order                     = wc_get_order( $order_id );
		if ( ! $order ) {
			return false;
		}
		$order_number       = $order->get_order_number();
		$billing_first_name = $order->get_billing_first_name();
		$billing_last_name  = $order->get_billing_last_name();
		$user_email         = $order->get_billing_email();
		if ( ! $user_email ) {
			return false;
		}
		$language = '';
		if ( is_plugin_active( 'sitepress-multilingual-cms/sitepress.php' ) ) {
			$language = $order->get_meta( 'wpml_language', true );
		}
		if ( ! $language && function_exists( 'pll_get_post_language' ) ) {
			$language = pll_get_post_language( $order_id );
		}
		$email_column_tracking_number = stripslashes( self::$settings->get_params( 'email_column_tracking_number', '', $language ) );
		$email_column_carrier_name    = stripslashes( self::$settings->get_params( 'email_column_carrier_name', '', $language ) );
		$email_column_tracking_url    = stripslashes( self::$settings->get_params( 'email_column_tracking_url', '', $language ) );
		$email_send_all_order_items   = self::$settings->get_params( 'email_send_all_order_items' );

		$line_items = $order->get_items();
		if ( empty( $line_items ) ) {
			return false;
		}
		$track_per_quantity = self::$settings->get_params( 'track_per_quantity' );
		if ( !empty( $updated_items ) ) {
			foreach ( $updated_items as $updated_item ) {
				if ( ! $updated_item['order_item_id'] ) {
					$g_tracking['tracking_number']       = $updated_item['tracking_number'];
					$g_tracking['carrier_name']          = $updated_item['carrier_name'];
					$g_tracking['carrier_url']           = $updated_item['carrier_url'];
					$g_tracking['tracking_url']          = $updated_item['tracking_url'];
					self::$default_tracking[ $order_id ] = $g_tracking;
					break;
				}
			}
		}
		if ( ! isset( self::$default_tracking[ $order_id ] ) ) {
			$_wot_tracking_number  = $order->get_meta( '_wot_tracking_number', true );
			$_wot_tracking_carrier = $order->get_meta( '_wot_tracking_carrier', true );
			if ( $_wot_tracking_number && $_wot_tracking_carrier ) {
				$carrier = self::$settings->get_shipping_carrier_by_slug( $_wot_tracking_carrier, '' );
				if ( is_array( $carrier ) && count( $carrier ) && empty( $carrier['digital_delivery'] ) ) {
					$carrier_url                         = $carrier['url'];
					$carrier_name                        = $carrier['name'];
					$display_name                        = empty( $carrier['display_name'] ) ? $carrier_name : $carrier['display_name'];
					$tracking_url_show                   = apply_filters( 'vi_woo_orders_tracking_current_tracking_url_show',
						self::$settings->get_url_tracking( $carrier_url, $_wot_tracking_number, $_wot_tracking_carrier, $order->get_shipping_postcode(), false, false, $order_id ),
						'', $order_id );
					$carrier_url_show                    = str_replace( array(
						'{tracking_number}',
						'{postal_code}'
					), '', $carrier_url );
					$g_tracking['tracking_number']       = $_wot_tracking_number;
					$g_tracking['carrier_name']          = $display_name;
					$g_tracking['carrier_url']           = $carrier_url_show;
					$g_tracking['tracking_url']          = $tracking_url_show;
					self::$default_tracking[ $order_id ] = $g_tracking;
				}
			}
		}

		ob_start();
		?>
        <table class="<?php echo esc_attr( VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::set( 'table-container' ) ) ?>">
            <thead>
            <tr>
                <th><?php esc_html_e( 'Product title', 'woocommerce-orders-tracking' ) ?></th>
				<?php
				if ( $email_column_tracking_number ) {
					?>
                    <th><?php esc_html_e( 'Tracking number', 'woocommerce-orders-tracking' ) ?></th>
					<?php
				}
				if ( $email_column_carrier_name ) {
					?>
                    <th><?php esc_html_e( 'Carrier name', 'woocommerce-orders-tracking' ) ?></th>
					<?php
				}
				if ( $email_column_tracking_url ) {
					?>
                    <th><?php esc_html_e( 'Tracking url', 'woocommerce-orders-tracking' ) ?></th>
					<?php
				}
				?>
            </tr>
            </thead>
            <tbody>
			<?php
            if (!empty($updated_items) && !$email_send_all_order_items){
	            foreach ( $updated_items as $item ) {
		            if ( ! $item['order_item_id'] ) {
			            continue;
		            }
		            $carrier_url                   = str_replace( array(
			            '{tracking_number}',
			            '{postal_code}'
		            ), '', $item['carrier_url'] );
		            $g_tracking['tracking_number'] = $item['tracking_number'];
		            $g_tracking['carrier_name']    = $item['carrier_name'];
		            $g_tracking['carrier_url']     = $carrier_url;
		            $g_tracking['tracking_url']    = $item['tracking_url'];
		            self::print_item_tracking( $item['order_item_name'], $item['tracking_number'], $item['carrier_name'], $carrier_url, $item['tracking_url'],
			            $email_column_tracking_number, $email_column_carrier_name, $email_column_tracking_url );
	            }
            }
            if ($email_send_all_order_items || empty($updated_items)){
	            $woo_orders_tracking_items = [];
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
                    $send_data = [$current_tracking_data];
		            if ( $track_per_quantity) {
			            $item_tracking_data = wc_get_order_item_meta( $item_id, '_vi_wot_order_item_tracking_data_by_quantity', true );
			            $item_tracking_data = $item_tracking_data ? vi_wot_json_decode( $item_tracking_data ) : array();
			            if ( is_array($item_tracking_data)  ) {
                            foreach ($item_tracking_data as $current_tracking_data){
                                $send_data[] = $current_tracking_data;
                            }
			            }
		            }
                    $total_tracking = count($send_data);
		            foreach ($send_data as $k =>  $current_tracking_data){
			            self::print_tracking_row( $current_tracking_data, $item_id, $line_item, $order_id, $order, $email_column_tracking_number,
				            $email_column_carrier_name, $email_column_tracking_url, $g_tracking, true, $k, $total_tracking );
		            }
	            }
            }
			?>
            </tbody>
        </table>
		<?php
		$tracking_table = apply_filters( 'woo_orders_tracking_table_html', ob_get_clean(), $order_id );
		$email_template = self::$settings->get_params( 'email_template', '', $language );
		$use_template   = false;
		if ( $email_template && VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::is_email_template_customizer_active() ) {
			$email_template_obj = get_post( $email_template );
			if ( $email_template_obj && $email_template_obj->post_type === 'viwec_template' ) {
				$use_template = true;
				$viwec_email  = new VIWEC_Render_Email_Template( array(
					'template_id' => $email_template,
					'order'       => $order
				) );
				ob_start();
				$viwec_email->get_content();
				$content = ob_get_clean();
				$subject = $viwec_email->get_subject();
				$content = str_replace( array(
					'{wot_order_id}',
					'{wot_order_number}',
					'{wot_billing_first_name}',
					'{wot_billing_last_name}',
					'{wot_tracking_number}',
					'{wot_carrier_name}',
					'{wot_carrier_url}',
					'{wot_tracking_url}',
				), array(
					$order_id,
					$order_number,
					$billing_first_name,
					$billing_last_name,
					$g_tracking['tracking_number'],
					$g_tracking['carrier_name'],
					esc_url( $g_tracking['carrier_url'] ),
					esc_url( $g_tracking['tracking_url'] ),
				), $content );
				$subject = str_replace( array(
					'{wot_order_id}',
					'{wot_order_number}',
					'{wot_billing_first_name}',
					'{wot_billing_last_name}',
					'{wot_tracking_number}',
					'{wot_carrier_name}',
					'{wot_carrier_url}',
					'{wot_tracking_url}',
				), array(
					$order_id,
					$order_number,
					$billing_first_name,
					$billing_last_name,
					$g_tracking['tracking_number'],
					$g_tracking['carrier_name'],
					esc_url( $g_tracking['carrier_url'] ),
					esc_url( $g_tracking['tracking_url'] ),
				), $subject );
			}
		}

		$mailer = WC()->mailer();
		$email  = new WC_Email();
		if ( ! $use_template ) {
			$content = stripslashes( self::$settings->get_params( 'email_content', '', $language ) );
			$subject = stripslashes( self::$settings->get_params( 'email_subject', '', $language ) );
			$heading = stripslashes( self::$settings->get_params( 'email_heading', '', $language ) );
			$subject = str_replace( array(
				'{order_id}',
				'{order_number}',
				'{billing_first_name}',
				'{billing_last_name}',
				'{tracking_number}',
				'{carrier_name}',
				'{carrier_url}',
				'{tracking_url}',
			), array(
				$order_id,
				$order_number,
				$billing_first_name,
				$billing_last_name,
				$g_tracking['tracking_number'],
				$g_tracking['carrier_name'],
				esc_url( $g_tracking['carrier_url'] ),
				esc_url( $g_tracking['tracking_url'] ),
			), $subject );
			$heading = str_replace( array(
				'{order_id}',
				'{order_number}',
				'{billing_first_name}',
				'{billing_last_name}',
				'{tracking_number}',
				'{carrier_name}',
				'{carrier_url}',
				'{tracking_url}',
			), array(
				$order_id,
				$order_number,
				$billing_first_name,
				$billing_last_name,
				$g_tracking['tracking_number'],
				$g_tracking['carrier_name'],
				esc_url( $g_tracking['carrier_url'] ),
				esc_url( $g_tracking['tracking_url'] ),
			), $heading );
			$content = str_replace( array(
				'{order_id}',
				'{order_number}',
				'{billing_first_name}',
				'{billing_last_name}',
				'{tracking_table}',
				'{tracking_number}',
				'{carrier_name}',
				'{carrier_url}',
				'{tracking_url}',
			), array(
				$order_id,
				$order_number,
				$billing_first_name,
				$billing_last_name,
				$tracking_table,
				$g_tracking['tracking_number'],
				$g_tracking['carrier_name'],
				esc_url( $g_tracking['carrier_url'] ),
				esc_url( $g_tracking['tracking_url'] ),
			), $content );
			$content = $email->style_inline( $mailer->wrap_message( $heading, $content ) );
		}
        $email_cc = self::$settings->get_params('email_cc');
        $email_bcc = self::$settings->get_params('email_bcc');
        $headers = "Content-Type: text/html\r\nReply-to: {$email->get_from_name()} <{$email->get_from_address()}>\r\n";
		$headers = apply_filters( 'woo_orders_tracking_email_headers',$headers , $email );
        if (is_email($email_cc)){
	        $headers .= "Cc: $email_cc <$email_cc>\r\n";
        }
        if (is_email($email_bcc)){
	        $headers .= "Bcc: $email_bcc <$email_bcc>\r\n";
        }
		add_filter( 'woocommerce_email_styles', array( __CLASS__, 'woocommerce_email_styles' ) );
		$send = $email->send( $user_email, $subject, $content, $headers, array() );
		remove_filter( 'woocommerce_email_styles', array( __CLASS__, 'woocommerce_email_styles' ) );
		if ( $update_scheduled_emails && false !== $send ) {
			/*Remove from scheduled orders if any*/
			$orders = get_option( 'vi_wot_send_mails_for_import_csv_function_orders' );
			if ( $orders ) {
				$orders = vi_wot_json_decode( $orders );
				if ( count( $orders ) ) {
					$orders = array_diff( $orders, array( $order_id ) );
					update_option( 'vi_wot_send_mails_for_import_csv_function_orders', vi_wot_json_encode( $orders ) );
				}
			}
		}

		return $send;
	}

	/**
	 * @param $item_name
	 * @param $tracking_number
	 * @param $carrier_name
	 * @param $carrier_url
	 * @param $tracking_url
	 * @param $email_column_tracking_number
	 * @param $email_column_carrier_name
	 * @param $email_column_tracking_url
	 */
	protected static function print_item_tracking( $item_name, $tracking_number, $carrier_name, $carrier_url, $tracking_url, $email_column_tracking_number, $email_column_carrier_name, $email_column_tracking_url, $index=null,  $total_tracking = null) {
		?>
        <tr>
			<?php
			if ($index !== null && $total_tracking !== null){
				if (!$index){
					echo wp_kses_post(sprintf('<td rowspan="%s">%s</td>',$total_tracking,$item_name));
				}
			}else{
				echo wp_kses_post(sprintf('<td>%s</td>',$item_name));
			}
			if ( $email_column_tracking_number ) {
				?>
                <td><?php echo wp_kses_post(str_replace( array(
						'{tracking_number}',
						'{carrier_name}',
						'{carrier_url}',
						'{tracking_url}',
					), array(
						$tracking_number,
						$carrier_name,
						$carrier_url,
						$tracking_url,
					), $email_column_tracking_number )); ?></td>
				<?php
			}
			if ( $email_column_carrier_name ) {
				?>
                <td><?php echo wp_kses_post(str_replace( array(
						'{tracking_number}',
						'{carrier_name}',
						'{carrier_url}',
						'{tracking_url}',
					), array(
						$tracking_number,
						$carrier_name,
						$carrier_url,
						$tracking_url,
					), $email_column_carrier_name )); ?></td>
				<?php
			}
			if ( $email_column_tracking_url ) {
				?>
                <td><?php echo wp_kses_post(str_replace( array(
						'{tracking_number}',
						'{carrier_name}',
						'{carrier_url}',
						'{tracking_url}',
					), array(
						$tracking_number,
						$carrier_name,
						$carrier_url,
						$tracking_url,
					), $email_column_tracking_url )); ?></td>
				<?php
			}
			?>
        </tr>
		<?php
	}

	/**
	 * @param      $current_tracking_data
	 * @param      $item_id
	 * @param      $line_item WC_Order_Item
	 * @param      $order_id
	 * @param      $order     WC_Order
	 * @param      $email_column_tracking_number
	 * @param      $email_column_carrier_name
	 * @param      $email_column_tracking_url
	 * @param      $g_tracking
	 * @param bool $allow_empty
	 */
	protected static function print_tracking_row( $current_tracking_data, $item_id, $line_item, $order_id, $order, $email_column_tracking_number, $email_column_carrier_name, $email_column_tracking_url, &$g_tracking, $allow_empty = true , $index=null, $total_tracking=null) {
		global $woo_orders_tracking_items;
		$tracking_number  = $current_tracking_data['tracking_number'];
		$carrier_slug     = $current_tracking_data['carrier_slug'];
		$carrier_url      = $current_tracking_data['carrier_url'];
		$carrier_name     = $current_tracking_data['carrier_name'];
		$display_name     = $carrier_name;
		$carrier          = self::$settings->get_shipping_carrier_by_slug( $carrier_slug, '' );
		$digital_delivery = 0;
		if ( is_array( $carrier ) && count( $carrier ) ) {
			if ( ! empty( $carrier['digital_delivery'] ) ) {
				$digital_delivery = 1;
			}
			$carrier_url  = $carrier['url'];
			$carrier_name = $carrier['name'];
			$display_name = empty( $carrier['display_name'] ) ? $carrier_name : $carrier['display_name'];
		}
		if ( ! $tracking_number && ! $digital_delivery && self::$settings->get_params( 'manage_tracking' ) !== 'items_only' ) {
			if ( isset( self::$default_tracking[ $order_id ] ) ) {
				$tracking_number = self::$default_tracking[ $order_id ]['tracking_number'];
				$carrier_url     = self::$default_tracking[ $order_id ]['carrier_url'];
				$display_name    = self::$default_tracking[ $order_id ]['carrier_name'];
				$tracking_url    = self::$default_tracking[ $order_id ]['tracking_url'];
			}
		}
		if ( $tracking_number || $digital_delivery ) {
			$carrier_url_show = str_replace( array(
				'{tracking_number}',
				'{postal_code}'
			), '', $carrier_url );
			if ( isset( $tracking_url ) ) {
				$tracking_url_show = $tracking_url;
			} else {
				if ( $tracking_number ) {
					$tracking_url_show = apply_filters( 'vi_woo_orders_tracking_current_tracking_url_show',
						self::$settings->get_url_tracking( $carrier_url, $tracking_number, $carrier_slug, $order->get_shipping_postcode(), false, false, $order_id ), $item_id,
						$order_id );
				} else {
					$tracking_url_show = $carrier_url_show;
				}
			}
			$woo_orders_tracking_items[] = array(
				'order_item_name' => $line_item->get_name(),
				'tracking_number' => $tracking_number,
				'carrier_name'    => $display_name,
				'tracking_url'    => $tracking_url_show,
				'carrier_url'     => $carrier_url_show,
			);
			if ( empty( $g_tracking['tracking_number'] ) ) {
				$g_tracking['tracking_number'] = $tracking_number;
				$g_tracking['carrier_name']    = $display_name;
				$g_tracking['carrier_url']     = $carrier_url_show;
				$g_tracking['tracking_url']    = $tracking_url_show;
			}
			self::print_item_tracking( $line_item->get_name(), $tracking_number, $display_name, $carrier_url_show, $tracking_url_show, $email_column_tracking_number,
				$email_column_carrier_name, $email_column_tracking_url, $index, $total_tracking );
		} elseif ( $allow_empty ) {
			$woo_orders_tracking_items[] = array(
				'order_item_name' => $line_item->get_name(),
				'tracking_number' => '',
				'carrier_name'    => '',
				'tracking_url'    => '',
				'carrier_url'     => '',
			);
			?>
            <tr>
				<?php
                if ($index !== null && $total_tracking !== null){
                    if (!$index){
	                    echo wp_kses_post(sprintf('<td rowspan="%s">%s</td>',$total_tracking,$line_item->get_name()));
                    }
                }else{
                    echo wp_kses_post(sprintf('<td>%s</td>',$line_item->get_name()));
                }
				if ( $email_column_tracking_number ) {
					?>
                    <td></td>
					<?php
				}
				if ( $email_column_carrier_name ) {
					?>
                    <td></td>
					<?php
				}
				if ( $email_column_tracking_url ) {
					?>
                    <td></td>
					<?php
				}
				?>
            </tr>
			<?php
		}
	}

	public static function woocommerce_email_styles( $css ) {
		$css .= 'table.woo-orders-tracking-table-container {
    border: 1px solid #e5e5e5 !important;
    vertical-align: middle;
    width: 100%;
}
table.woo-orders-tracking-table-container th {
    border: 1px solid #e5e5e5;
    vertical-align: middle;
    padding: 12px;
    text-align: left;
}
table.woo-orders-tracking-table-container td {
    border: 1px solid #e5e5e5;
    vertical-align: middle;
    padding: 12px;
    text-align: left;
}
table.woo-orders-tracking-table-container td a {
    text-decoration: none !important;
}';

		return $css;
	}
}