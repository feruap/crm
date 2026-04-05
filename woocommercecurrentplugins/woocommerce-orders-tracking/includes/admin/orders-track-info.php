<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_ORDERS_TRACK_INFO {
	protected static $settings;
	protected $carriers;
	protected static $tracking_service_action_buttons;

	public function __construct() {
		self::$settings = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_instance();
		VILLATHEME_ADMIN_SHOW_MESSAGE::get_instance();
		$this->carriers = array();
		add_action( 'admin_enqueue_scripts', array( $this, 'admin_enqueue_script' ), 99 );
		add_filter( 'manage_edit-shop_order_columns', array( $this, 'add_new_order_admin_list_column' ) );
		add_filter( 'manage_woocommerce_page_wc-orders_columns', array( $this, 'add_new_order_admin_list_column' ) );
		add_action( 'manage_shop_order_posts_custom_column', array( $this, 'manage_shop_order_posts_custom_column' ), 10, 2 );
		add_action( 'manage_woocommerce_page_wc-orders_custom_column', array( $this, 'manage_shop_order_posts_custom_column' ), 10, 2 );
		add_action( 'wp_ajax_vi_wot_refresh_track_info', array( $this, 'refresh_track_info' ) );
		add_action( 'wp_ajax_vi_wot_refresh_tracking_number_column', array( $this, 'refresh_tracking_number_column' ) );
		add_action( 'wp_ajax_vi_woo_orders_tracking_send_tracking_email', array( $this, 'send_tracking_email' ) );
		add_action( 'restrict_manage_posts', array( $this, 'restrict_manage_posts' ) );
		add_action( 'woocommerce_order_list_table_restrict_manage_orders', array( $this, 'restrict_manage_posts' ) );
		add_action( 'woocommerce_orders_table_query_clauses', array( $this, 'add_items_query' ) );
		add_filter( 'posts_where', array( $this, 'posts_where' ), 10, 2 );
		add_filter( 'vi_woo_orders_tracking_is_order_delivered', array( $this, 'woo_orders_tracking_is_order_delivered' ), 10, 3 );
	}

	public function admin_enqueue_script() {
		global $pagenow, $post_type;
		$enqueue = false;
		if ( $pagenow === 'edit.php' && $post_type === 'shop_order' ) {
			$enqueue = true;
		}
		if ( ! $enqueue ) {
			$page    = isset( $_GET['page'] ) ? wc_clean( wp_unslash( $_GET['page'] ) ) : '';
			$enqueue = $page === 'wc-orders';
		}
		if ( $enqueue ) {
			wp_enqueue_style( 'semantic-ui-popup', VI_WOOCOMMERCE_ORDERS_TRACKING_CSS . 'popup.min.css', '', VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION );
			wp_enqueue_style( 'vi-wot-admin-edit-order-css', VI_WOOCOMMERCE_ORDERS_TRACKING_CSS . 'admin-edit-order.css', '', VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION );
			wp_enqueue_style( 'vi-wot-admin-order-manager-icon', VI_WOOCOMMERCE_ORDERS_TRACKING_CSS . 'woo-orders-tracking-icons.css', '', VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION );
			wp_enqueue_script( 'vi-wot-admin-edit-carrier-functions-js', VI_WOOCOMMERCE_ORDERS_TRACKING_JS . 'carrier-functions.js', array( 'jquery' ),
				VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION, false );
			self::enqueue_main_script();
			add_action( 'admin_footer', array( $this, 'orders_tracking_edit_tracking_footer' ) );
			add_action( 'admin_footer', array( $this, 'add_nonce_field' ) );
		}
	}

	/**
	 * Enqueue main js and css files
	 * Can be called static to also use on order edit page
	 */
	public static function enqueue_main_script() {
		wp_enqueue_style( 'vi-wot-admin-order-manager-css', VI_WOOCOMMERCE_ORDERS_TRACKING_CSS . 'admin-order-manager.css', '', VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION );
		$css = '.woo-orders-tracking-tracking-number-container-delivered .woo-orders-tracking-tracking-number .woo-orders-tracking-tracking-number-value{color:'
		       . self::$settings->get_params( 'timeline_track_info_status_background_delivered' ) . '}';
		$css .= '.woo-orders-tracking-tracking-number-container-pickup .woo-orders-tracking-tracking-number .woo-orders-tracking-tracking-number-value{color:'
		        . self::$settings->get_params( 'timeline_track_info_status_background_pickup' ) . '}';
		$css .= '.woo-orders-tracking-tracking-number-container-transit .woo-orders-tracking-tracking-number .woo-orders-tracking-tracking-number-value{color:'
		        . self::$settings->get_params( 'timeline_track_info_status_background_transit' ) . '}';
		$css .= '.woo-orders-tracking-tracking-number-container-pending .woo-orders-tracking-tracking-number .woo-orders-tracking-tracking-number-value{color:'
		        . self::$settings->get_params( 'timeline_track_info_status_background_pending' ) . '}';
		$css .= '.woo-orders-tracking-tracking-number-container-alert .woo-orders-tracking-tracking-number .woo-orders-tracking-tracking-number-value{color:'
		        . self::$settings->get_params( 'timeline_track_info_status_background_alert' ) . '}';
		wp_add_inline_style( 'vi-wot-admin-order-manager-css', $css );
		if ( ! wp_script_is( 'vi-wot-admin-order-manager-js' ) ) {
			wp_enqueue_script( 'vi-wot-admin-order-manager-js', VI_WOOCOMMERCE_ORDERS_TRACKING_JS . 'admin-order-manager.js', array( 'jquery' ),
				VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION, false );
			$shipping_carrier_default = self::$settings->get_params( 'shipping_carrier_default' );
			wp_localize_script(
				'vi-wot-admin-order-manager-js',
				'vi_wot_admin_order_manager',
				array(
					'ajax_url'                            => admin_url( 'admin-ajax.php' ),
					'paypal_image'                        => VI_WOOCOMMERCE_ORDERS_TRACKING_PAYPAL_IMAGE,
					'loading_image'                       => VI_WOOCOMMERCE_ORDERS_TRACKING_LOADING_IMAGE,
					'i18n_order_row'                      => esc_html__( 'Tracking of the whole order: use this if this order only uses 1 tracking number for all items',
						'woocommerce-orders-tracking' ),
					'i18n_sku'                            => esc_html__( 'SKU:', 'woocommerce-orders-tracking' ),
					'i18n_message_copy'                   => esc_html__( 'Tracking number is copied to clipboard', 'woocommerce-orders-tracking' ),
					'i18n_tracking_updated'               => esc_html__( 'Tracking number updated: #{order_id}', 'woocommerce-orders-tracking' ),
					'i18n_error_sms'                      => esc_html__( 'Error sending SMS: #{order_id}', 'woocommerce-orders-tracking' ),
					'i18n_error_email'                    => esc_html__( 'Error sending email: #{order_id}', 'woocommerce-orders-tracking' ),
					'i18n_error_paypal'                   => esc_html__( 'Error adding {tracking_number} to PayPal: #{order_id}', 'woocommerce-orders-tracking' ),
					'i18n_error_tracking'                 => esc_html__( 'Error saving tracking number {tracking_number}: #{order_id}', 'woocommerce-orders-tracking' ),
					'i18n_error_api'                      => sprintf( esc_html__( 'Error adding tracking number {tracking_number} to %s', 'woocommerce-orders-tracking' ),// phpcs:ignore WordPress.WP.I18n.MissingTranslatorsComment
						VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::service_carriers_list( self::$settings->get_params( 'service_carrier_type' ) ) ),
					'i18n_delete_tracking_number_warning' => esc_html__( 'You cannot delete tracking number', 'woocommerce-orders-tracking' ),
					'shipping_carrier_default'            => $shipping_carrier_default,
					'shipping_carrier_default_url_check'  => self::$settings->get_shipping_carrier_url( $shipping_carrier_default ),
					'active_carriers'                     => self::$settings->get_params( 'active_carriers' ),
					'custom_carriers_list'                => self::$settings->get_params( 'custom_carriers_list' ),
					'shipping_carriers_define_list'       => self::$settings->get_params( 'shipping_carriers_define_list' ),
					'paypal_enable'                       => self::$settings->get_params( 'paypal_enable' ) ?: '',
					'_wpnonce'                            => wp_create_nonce( 'wp_rest' ),
					'get_trackings_endpoint'              => get_rest_url( null, 'woo-orders-tracking/v1/tracking/get' ),
					'set_trackings_endpoint'              => get_rest_url( null, 'woo-orders-tracking/v1/tracking/set' ),
				)
			);
			$insert_tag = "<a class='page-title-action woo-orders-tracking-import-csv' target='_blank' href=" . esc_url( admin_url( 'admin.php?page=woo-orders-tracking-import-csv' ) ) . ">"
			              . esc_html__( 'Import tracking number', 'woocommerce-orders-tracking' ) . "</a><a class='page-title-action woo-orders-tracking-export' target='_blank' href="
			              . esc_url( admin_url( 'admin.php?page=woo-orders-tracking-export' ) )
			              . ">" . esc_html__( 'Export tracking number ', 'woocommerce-orders-tracking' ) . "</a>";
			wp_add_inline_script( 'vi-wot-admin-order-manager-js', "jQuery(document).ready(function ($) {
                'use strict';
                if (!$('.woo-orders-tracking-export').length) {
                    $('.wrap .page-title-action').eq(0).after(\"" . $insert_tag . "\");}});"
			);
		}
	}

	/**
	 * Popup shown when clicking a tracking number edit button
	 */
	public function orders_tracking_edit_tracking_footer() {
		?>
        <div class="<?php echo esc_attr( self::set( array(
			'edit-tracking-container',
			'edit-tracking-container-all',
			'hidden'
		) ) ) ?>">
			<?php wp_nonce_field( 'vi_wot_item_action_nonce', '_vi_wot_item_nonce' ) ?>
            <div class="<?php echo esc_attr( self::set( 'overlay' ) ) ?>"></div>
            <div class="<?php echo esc_attr( self::set( array(
				'edit-tracking-content',
			) ) ) ?>">
                <div class="<?php echo esc_attr( self::set( 'edit-tracking-content-header' ) ) ?>">
					<?php self::edit_tracking_content_header(); ?>
                </div>
                <div class="<?php echo esc_attr( self::set( 'edit-tracking-content-body' ) ) ?>">
					<?php
					self::edit_tracking_content_main_row();
					self::edit_tracking_content_options_row();
					?>
                </div>
                <div class="<?php echo esc_attr( self::set( 'edit-tracking-content-footer' ) ) ?>">
					<?php self::edit_tracking_content_footer(); ?>
                </div>
            </div>
            <div class="<?php echo esc_attr( self::set( array( 'saving-overlay', 'hidden' ) ) ) ?>"></div>
        </div>
		<?php
	}

	/**
	 * Popup header
	 */
	public static function edit_tracking_content_header() {
		?>
        <h2><?php esc_html_e( 'Edit tracking', 'woocommerce-orders-tracking' ) ?>: <select
                    class="<?php echo esc_attr( self::set( 'edit-tracking-content-header-order-select' ) ) ?>"></select>
        </h2>
        <span class="<?php echo esc_attr( self::set( 'edit-tracking-close' ) ) ?>"></span>
		<?php
	}

	/**
	 * Popup footer
	 */
	public static function edit_tracking_content_footer() {
		?>
        <div><?php esc_html_e( 'To add a new carrier or turn on/off a carrier, please go to ', 'woocommerce-orders-tracking' ) ?>
            <a target="_blank"
               href="<?php echo esc_url( admin_url( 'admin.php?page=woocommerce-orders-tracking#shipping_carriers' ) ) ?>"><?php esc_html_e( 'Carriers settings',
					'woocommerce-orders-tracking' ) ?></a></label>
        </div>
        <div>
            <span class="button button-primary <?php echo esc_attr( self::set( 'edit-tracking-button-save-all' ) ) ?>"><?php esc_html_e( 'Save',
		            'woocommerce-orders-tracking' ) ?></span>
            <span class="button <?php echo esc_attr( self::set( 'edit-tracking-button-cancel-all' ) ) ?>"><?php esc_html_e( 'Cancel', 'woocommerce-orders-tracking' ) ?></span>
        </div>
		<?php
	}

	/**
	 * Tracking numbers table
	 */
	public static function edit_tracking_content_main_row() {
		?>
        <div class="<?php echo esc_attr( self::set( array(
			'edit-tracking-content-body-row',
			'edit-tracking-content-body-row-all'
		) ) ) ?>">
            <table class="wp-list-table widefat fixed striped">
                <thead>
                <tr>
                    <th style="width: 3ch"><?php esc_html_e( 'Item ID', 'woocommerce-orders-tracking' ) ?></th>
                    <th><?php esc_html_e( 'Item detail', 'woocommerce-orders-tracking' ) ?></th>
                    <th><?php esc_html_e( 'Tracking number', 'woocommerce-orders-tracking' ) ?></th>
                    <th><?php esc_html_e( 'Tracking carrier', 'woocommerce-orders-tracking' ) ?></th>
                    <th class="<?php echo esc_attr( self::set( 'edit-tracking-content-body-row-paypal-col' ) ) ?>"
                        id="<?php echo esc_attr( self::set( 'edit-tracking-content-body-row-paypal-col' ) ) ?>">
                        <span><input
                                    id="<?php echo esc_attr( self::set( 'edit-tracking-content-body-row-paypal-bulk' ) ) ?>"
                                    class="<?php echo esc_attr( self::set( 'edit-tracking-content-body-row-paypal-bulk' ) ) ?>"
                                    type="checkbox"
                                    title="<?php esc_attr_e( 'Toggle all', 'woocommerce-orders-tracking' ) ?>"><label
                                    for="<?php echo esc_attr( self::set( 'edit-tracking-content-body-row-paypal-bulk' ) ) ?>"><img
                                        title="<?php esc_attr_e( 'Add to PayPal', 'woocommerce-orders-tracking' ) ?>"
                                        src="<?php echo esc_url( VI_WOOCOMMERCE_ORDERS_TRACKING_PAYPAL_IMAGE ) ?>"></label></span>
                    </th>
                </tr>
                </thead>
                <tbody class="<?php echo esc_attr( self::set( 'edit-tracking-content-body-row-details' ) ) ?>">

                </tbody>
            </table>
        </div>
		<?php
	}

	/**
	 * @param $order WC_Order|null
	 */
	public static function edit_tracking_content_options_row( $order = null ) {
		$all_order_statuses = wc_get_order_statuses();
		?>
        <div class="<?php echo esc_attr( self::set( array(
			'edit-tracking-content-body-row',
			'edit-tracking-content-body-row-options',
		) ) ) ?>">
            <div class="<?php echo esc_attr( self::set( array(
				'edit-tracking-content-body-row-item',
				'edit-tracking-content-body-row-item-checkbox-container'
			) ) ) ?>">
                <div class="<?php echo esc_attr( self::set( 'edit-tracking-change-order-status-container' ) ) ?>">
                    <label for="<?php echo esc_attr( self::set( 'order_status' ) ) ?>"><?php esc_html_e( 'Change order status to: ', 'woocommerce-orders-tracking' ) ?></label>
                    <select name="<?php echo esc_attr( self::set( 'order_status', true ) ) ?>"
                            id="<?php echo esc_attr( self::set( 'order_status' ) ) ?>"
                            class="<?php echo esc_attr( self::set( 'order_status' ) ) ?>">
                        <option value=""><?php esc_html_e( 'Not Change', 'woocommerce-orders-tracking' ) ?></option>
						<?php
						if ( count( $all_order_statuses ) ) {
							$order_status = self::$settings->get_params( 'order_status' );
							foreach ( $all_order_statuses as $status_id => $status_name ) {
								?>
                                <option value="<?php echo esc_attr( $status_id ) ?>" <?php selected( $order_status, $status_id ) ?>><?php echo esc_html( $status_name ) ?></option>
								<?php
							}
						}
						?>
                    </select>
                </div>
                <div>
                    <input type="checkbox"
						<?php checked( self::$settings->get_params( 'email_enable' ), '1' ) ?>
                           id="<?php echo esc_attr( self::set( 'edit-tracking-send-email' ) ) ?>"
                           class="<?php echo esc_attr( self::set( 'edit-tracking-send-email' ) ) ?>">
                    <label for="<?php echo esc_attr( self::set( 'edit-tracking-send-email' ) ) ?>"><?php esc_html_e( 'Send email to customer if tracking info changes.',
							'woocommerce-orders-tracking' ) ?>
                        <a target="_blank"
                           href="<?php echo esc_url( admin_url( 'admin.php?page=woocommerce-orders-tracking#email' ) ) ?>"><?php esc_html_e( 'View settings',
								'woocommerce-orders-tracking' ) ?></a></label>
                </div>
				<?php
				$sms_provider = self::$settings->get_params( 'sms_provider' );
				if ( self::$settings->get_params( "sms_{$sms_provider}_app_id" ) && self::$settings->get_params( "sms_{$sms_provider}_app_token" ) ) {
					?>
                    <div class="<?php echo esc_attr( self::set( 'edit-tracking-send-sms-container' ) ) ?>">
                        <input type="checkbox"
							<?php checked( self::$settings->get_params( 'sms_enable' ), '1' ) ?>
                               id="<?php echo esc_attr( self::set( 'edit-tracking-send-sms' ) ) ?>"
                               class="<?php echo esc_attr( self::set( 'edit-tracking-send-sms' ) ) ?>">
                        <label for="<?php echo esc_attr( self::set( 'edit-tracking-send-sms' ) ) ?>"><?php esc_html_e( 'Send SMS to customer if tracking info changes.',
								'woocommerce-orders-tracking' ) ?>
                            <a target="_blank"
                               href="<?php echo esc_url( admin_url( 'admin.php?page=woocommerce-orders-tracking#sms' ) ) ?>"><?php esc_html_e( 'View settings',
									'woocommerce-orders-tracking' ) ?></a></label>
                    </div>
					<?php
				}
				if ( $order ) {
					$transID       = $order->get_transaction_id();
					$paypal_method = $order->get_payment_method();
					if ( $transID && in_array( $paypal_method, VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_PAYPAL::get_supported_paypal_gateways() ) ) {
						?>
                        <div class="<?php echo esc_attr( self::set( array(
							'edit-tracking-content-body-row-add-to-paypal'
						) ) ) ?>">
                            <input type="checkbox"
                                   value="<?php echo esc_attr( $transID ) ?>"
                                   id="<?php echo esc_attr( self::set( 'edit-tracking-add-to-paypal' ) ) ?>"
                                   class="<?php echo esc_attr( self::set( 'edit-tracking-add-to-paypal' ) ) ?>">
                            <label for="<?php echo esc_attr( self::set( 'edit-tracking-add-to-paypal' ) ) ?>">
								<?php esc_html_e( 'Add tracking number to PayPal. ', 'woocommerce-orders-tracking' ) ?>
                                <a target="_blank"
                                   href="<?php echo esc_url( admin_url( 'admin.php?page=woocommerce-orders-tracking#paypal' ) ) ?>"><?php esc_html_e( 'View settings',
										'woocommerce-orders-tracking' ) ?></a>
                            </label>
                            <img src="<?php echo esc_url( VI_WOOCOMMERCE_ORDERS_TRACKING_PAYPAL_IMAGE ) ?>">
                        </div>
						<?php
					}
				}
				?>
            </div>
        </div>
		<?php
	}

	public static function set( $name, $set_name = false ) {
		return VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::set( $name, $set_name );
	}

	public function add_nonce_field() {
		wp_nonce_field( 'vi_wot_item_action_nonce', '_vi_wot_item_nonce' );
	}

	/**
	 * Tracking number column
	 *
	 * @param $columns
	 *
	 * @return mixed
	 */
	public function add_new_order_admin_list_column( $columns ) {
		$bulk_refresh = '';
		if ( self::$settings->get_params( 'service_carrier_enable' ) && self::$settings->get_params( 'service_carrier_api_key' )
		     && self::$settings->get_params( 'service_carrier_type' ) !== 'cainiao'
		) {
			$bulk_refresh = '<span class="woo_orders_tracking_icons-refresh ' . esc_attr( self::set( array(
					'tracking-service-refresh-bulk'
				) ) ) . '" title="' . esc_html__( 'Bulk refresh tracking', 'woocommerce-orders-tracking' ) . '"></span>';
		}
		$columns['vi_wot_tracking_code'] = '<span class="' . esc_attr( self::set( array(
				'tracking-service-refresh-bulk-container'
			) ) ) . '">' . esc_html__( 'Tracking Number', 'woocommerce-orders-tracking' ) . $bulk_refresh . '</span>';

		return $columns;
	}

	/**
	 * Functional buttons in Tracking number column for tracking services
	 *
	 * @param $tracking_link
	 * @param $current_tracking_data
	 * @param $tracking_status
	 *
	 * @return mixed
	 */
	private static function tracking_service_action_buttons_html( $tracking_link, $current_tracking_data, $tracking_status ) {
		if ( self::$tracking_service_action_buttons === null ) {
			self::$tracking_service_action_buttons = '';
			$service_carrier_enable                = self::$settings->get_params( 'service_carrier_enable' );
			$service_carrier_api_key               = self::$settings->get_params( 'service_carrier_api_key' );
			$service_carrier_type                  = self::$settings->get_params( 'service_carrier_type' );
			ob_start();
			?>
            <div class="<?php echo esc_attr( self::set( 'tracking-service-action-button-container' ) ) ?>">
                <span class="woo_orders_tracking_icons-duplicate <?php echo esc_attr( self::set( array(
	                'tracking-service-action-button',
	                'tracking-service-copy'
                ) ) ) ?>" title="<?php echo esc_attr__( 'Copy tracking number', 'woocommerce-orders-tracking' ) ?>">
                </span>
                <a href="{tracking_link}" target="_blank">
                    <span class="woo_orders_tracking_icons-redirect <?php echo esc_attr( self::set( array(
	                    'tracking-service-action-button',
	                    'tracking-service-track'
                    ) ) ) ?>"
                          title="<?php echo esc_attr__( 'Open tracking link', 'woocommerce-orders-tracking' ) ?>">
                    </span>
                </a>
				<?php
				if ( $service_carrier_enable && $service_carrier_api_key && $service_carrier_type !== 'cainiao' ) {
					?>
                    <span class="woo_orders_tracking_icons-refresh <?php echo esc_attr( self::set( array(
						'tracking-service-action-button',
						'tracking-service-refresh'
					) ) ) ?>" title="{button_refresh_title}">
                    </span>
					<?php
				}
				?>
                <span class="dashicons dashicons-edit <?php echo esc_attr( self::set( array(
					'tracking-service-action-button',
					'edit-order-tracking-item'
				) ) ) ?>" title="<?php echo esc_attr__( 'Edit tracking', 'woocommerce-orders-tracking' ) ?>">
                </span>
            </div>
			<?php
			self::$tracking_service_action_buttons = ob_get_clean();
		}
		$button_refresh_title = esc_html__( 'Update latest data', 'woocommerce-orders-tracking' );
		if ( ! empty( $current_tracking_data['last_update'] ) ) {
			$button_refresh_title = sprintf( esc_html__( 'Last update: %s. Click to refresh.', 'woocommerce-orders-tracking' ),// phpcs:ignore WordPress.WP.I18n.MissingTranslatorsComment
				date_i18n( 'Y-m-d H:i:s', $current_tracking_data['last_update'] ) );
		}

		return str_replace( array( '{button_refresh_title}', '{tracking_link}' ), array(
			$button_refresh_title,
			esc_url( $tracking_link )
		), self::$tracking_service_action_buttons );
	}

	/**
	 * @param $column
	 * @param $order_id
	 *
	 * @throws Exception
	 */
	public function manage_shop_order_posts_custom_column( $column, $order_id ) {
		if ( $column === 'vi_wot_tracking_code' ) {
			$this->tracking_number_column_html( $order_id );
		}
	}

	/**
	 * Tracking number column data of each order
	 *
	 * @param $order_id
	 */
	public static function tracking_number_column_html( $order_id ) {
		$order = wc_get_order( $order_id );
		if ( $order ) {
			$order_id   = $order->get_id();
			$line_items = $order->get_items();
			if ( count( $line_items ) ) {
				$tracking_list    = array();
				$transID          = $order->get_transaction_id();
				$paypal_method    = $order->get_payment_method();
				$paypal_available = 0;
				if ( $transID && in_array( $paypal_method, VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_PAYPAL::get_supported_paypal_gateways() ) ) {
					$paypal_available = 1;
				}
				$paypal_added_trackings = $order->get_meta( 'vi_wot_paypal_added_tracking_numbers', true );
				if ( ! $paypal_added_trackings ) {
					$paypal_added_trackings = array();
				}
				$manage_tracking    = self::$settings->get_params( 'manage_tracking' );
				$track_per_quantity = self::$settings->get_params( 'track_per_quantity' );
				if ( $manage_tracking === 'order_only' ) {
					$track_per_quantity = false;
				}
				?>
                <div class="<?php echo esc_attr( self::set( 'tracking-number-column-container' ) ) ?>">
					<?php
					$tracking_number  = $order->get_meta( '_wot_tracking_number', true );
					$tracking_carrier = $order->get_meta( '_wot_tracking_carrier', true );
					if ( $manage_tracking !== 'items_only' || ( $tracking_number && $tracking_carrier ) ) {
						self::print_tracking_row( array(
							'tracking_number' => $tracking_number,
							'carrier_slug'    => $tracking_carrier,
							'carrier_url'     => '',
							'carrier_name'    => '',
							'carrier_type'    => '',
							'status'          => $order->get_meta( '_wot_tracking_status', true ),
							'time'            => time(),
						), false, $order_id, $order, $transID, $paypal_method, $paypal_added_trackings, $tracking_list, '' );
					}
					foreach ( $line_items as $item_id => $line_item ) {
						$item_tracking_data    = $line_item->get_meta( '_vi_wot_order_item_tracking_data', true );
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
						if ( apply_filters( 'vi_woo_orders_tracking_show_tracking_of_order_item',
							( $manage_tracking !== 'order_only' || $current_tracking_data['tracking_number'] || $current_tracking_data['carrier_slug'] ), $item_id, $order_id )
						) {
							self::print_tracking_row( $current_tracking_data, $line_item, $order_id, $order, $transID, $paypal_method, $paypal_added_trackings, $tracking_list );
						}
						$quantity = $line_item->get_quantity();
						if ( $track_per_quantity ) {
							$item_tracking_data = $line_item->get_meta( '_vi_wot_order_item_tracking_data_by_quantity', true );
							$item_tracking_data = $item_tracking_data ? vi_wot_json_decode( $item_tracking_data ) : array();
							if ( $track_per_quantity === 'unlimited' ) {
								$i = 0;
								foreach ( $item_tracking_data as $current_tracking_data ) {
									if ( $current_tracking_data['tracking_number'] || $current_tracking_data['carrier_slug'] ) {
										self::print_tracking_row( $current_tracking_data, $line_item, $order_id, $order, $transID, $paypal_method, $paypal_added_trackings,
											$tracking_list, $i + 2 );
									}
									$i ++;
								}
//								for ( $i = 0; $i < $quantity - 1; $i ++ ) {
//									if ( isset( $item_tracking_data[ $i ] ) ) {
//										$current_tracking_data = $item_tracking_data[ $i ];
//										if ( $track_per_quantity || $current_tracking_data['tracking_number'] || $current_tracking_data['carrier_slug'] ) {
//											self::print_tracking_row( $current_tracking_data, $line_item, $order_id, $order, $transID, $paypal_method, $paypal_added_trackings,
//												$tracking_list, $i + 2 );
//										}
//									}
//								}
							} else if ( $quantity > 1 ) {
								for ( $i = 0; $i < $quantity - 1; $i ++ ) {
									$current_tracking_data = $item_tracking_data[ $i ] ?? array(
											'tracking_number' => '',
											'carrier_slug'    => '',
											'carrier_url'     => '',
											'carrier_name'    => '',
											'carrier_type'    => '',
											'time'            => time(),
										);
									self::print_tracking_row( $current_tracking_data, $line_item, $order_id, $order, $transID, $paypal_method, $paypal_added_trackings,
										$tracking_list, $i + 2 );
								}
							}
						}
					}
					?>
                    <div class="<?php echo esc_attr( self::set( 'edit-order-tracking-wrap' ) ) ?>">
                        <div class="<?php echo esc_attr( self::set( 'edit-order-tracking-container' ) ) ?>">
                                <span class="<?php echo esc_attr( self::set( 'edit-order-tracking' ) ) ?> dashicons dashicons-edit"
                                      data-order_id="<?php echo esc_attr( $order_id ) ?>"
                                      data-order_status="<?php echo esc_attr( $order->get_status() ) ?>"
                                      data-paypal_available="<?php echo esc_attr( $paypal_available ) ?>"
                                      data-sms_available="<?php echo $order->get_billing_phone() ? 1 : '' ?>"
                                      title="<?php esc_attr_e( 'Edit tracking', 'woocommerce-orders-tracking' ) ?>"></span>
                        </div>
						<?php
						if ( count( $tracking_list ) ) {
							?>
                            <div class="<?php echo esc_attr( self::set( 'send-tracking-email-container' ) ) ?>">
                                <span class="<?php echo esc_attr( self::set( 'send-tracking-email' ) ) ?> dashicons dashicons-email-alt"
                                      data-order_id="<?php echo esc_attr( $order_id ) ?>"
                                      title="<?php esc_attr_e( 'Send tracking email', 'woocommerce-orders-tracking' ) ?>"></span>
                            </div>
							<?php
						}
						?>
                    </div>
                    <div class="<?php echo esc_attr( self::set( array(
						'edit-tracking-overlay',
						'hidden'
					) ) ) ?>"></div>
                </div>
				<?php
			}
		}
	}

	/**
	 * @param $current_tracking_data
	 * @param $line_item WC_Order_Item|false
	 * @param $order_id
	 * @param $order     WC_Order
	 * @param $transID
	 * @param $paypal_method
	 * @param $paypal_added_trackings
	 * @param $tracking_list
	 * @param $quantity_index
	 */
	protected static function print_tracking_row(
		$current_tracking_data, $line_item, $order_id, $order, $transID, $paypal_method, $paypal_added_trackings, &$tracking_list, $quantity_index = 1
	) {
		$sku = $item_name = $item_id = '';
		if ( $line_item ) {
			$item_id   = $line_item->get_id();
			$item_name = $line_item->get_name();
			$product   = $line_item->get_product();
			if ( $product ) {
				$sku = $product->get_sku();
			}
		}
		$tracking_number  = apply_filters( 'vi_woo_orders_tracking_current_tracking_number', $current_tracking_data['tracking_number'], $item_id, $order_id );
		$carrier_url      = apply_filters( 'vi_woo_orders_tracking_current_tracking_url', $current_tracking_data['carrier_url'], $item_id, $order_id );
		$carrier_name     = apply_filters( 'vi_woo_orders_tracking_current_carrier_name', $current_tracking_data['carrier_name'], $item_id, $order_id );
		$carrier_slug     = apply_filters( 'vi_woo_orders_tracking_current_carrier_slug', $current_tracking_data['carrier_slug'], $item_id, $order_id );
		$tracking_status  = isset( $current_tracking_data['status'] ) ? VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::convert_status( $current_tracking_data['status'] ) : '';
		$digital_delivery = 0;
		$container_class  = array( 'tracking-number-container' );
		$tracking_html    = '';
		$paypal_status    = '0';
		if ( $tracking_number && ! in_array( $tracking_number, $tracking_list ) ) {
			$tracking_list[] = $tracking_number;
			$carrier         = self::$settings->get_shipping_carrier_by_slug( $current_tracking_data['carrier_slug'] );
			if ( is_array( $carrier ) && count( $carrier ) ) {
				$carrier_url  = $carrier['url'];
				$carrier_name = $carrier['name'];
				if ( $carrier['carrier_type'] === 'custom-carrier' && isset( $carrier['digital_delivery'] ) ) {
					$digital_delivery = $carrier['digital_delivery'];
				}
			}
			$tracking_url_show = apply_filters( 'vi_woo_orders_tracking_current_tracking_url_show',
				self::$settings->get_url_tracking( $carrier_url, $tracking_number, $carrier_slug, $order->get_shipping_postcode(), false, true, $order_id ), $item_id, $order_id );
			if ( $tracking_status ) {
				$container_class[] = 'tracking-number-container-' . $tracking_status;
			}
			ob_start();
			?>
            <span class="<?php echo esc_attr( self::set( 'tracking-number' ) ) ?>"
                  title="<?php printf( esc_attr__( 'Tracking carrier %s', 'woocommerce-orders-tracking' ), esc_attr( $carrier_name ) )// phpcs:ignore WordPress.WP.I18n.MissingTranslatorsComment ?>"><span
                        class="<?php echo esc_attr( self::set( 'tracking-number-value' ) ) ?>"><?php echo esc_html( $tracking_number ) ?></span> <span
                        class="<?php echo esc_attr( self::set( 'tracking-carrier' ) ) ?>"><?php echo wp_kses_post( sprintf( esc_html__( 'by %s', 'woocommerce-orders-tracking' ),// phpcs:ignore WordPress.WP.I18n.MissingTranslatorsComment
						'<strong>' . $carrier_name . '</strong>' ) ) ?></span></span>
			<?php
			echo wp_kses_post( self::tracking_service_action_buttons_html( $tracking_url_show, $current_tracking_data, $tracking_status ) );
			if ( $transID && in_array( $paypal_method, VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_PAYPAL::get_supported_paypal_gateways() ) ) {
				$paypal_class = array( 'item-tracking-button-add-to-paypal-container' );
				if ( ! in_array( $tracking_number, $paypal_added_trackings ) ) {
					$paypal_status  = '1';
					$paypal_class[] = 'paypal-active';
					$title          = esc_attr__( 'Add this tracking number to PayPal', 'woocommerce-orders-tracking' );
				} else {
					$paypal_status  = '2';
					$paypal_class[] = 'paypal-inactive';
					$title          = esc_attr__( 'This tracking number was added to PayPal', 'woocommerce-orders-tracking' );
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
			$tracking_html = ob_get_clean();
		} else {
			$container_class[] = 'hidden';
			ob_start();
			?>
            <span class="dashicons dashicons-edit <?php echo esc_attr( self::set( array(
				'tracking-service-action-button',
				'edit-order-tracking-item'
			) ) ) ?>" title="<?php echo esc_attr__( 'Edit tracking', 'woocommerce-orders-tracking' ) ?>">
            </span>
			<?php
			$tracking_html = ob_get_clean();
		}
		?>
        <div class="<?php echo esc_attr( self::set( $container_class ) ) ?>"
             data-tracking_number="<?php echo esc_attr( $tracking_number ) ?>"
             data-carrier_slug="<?php echo esc_attr( $carrier_slug ) ?>"
             data-paypal_status="<?php echo esc_attr( $paypal_status ) ?>"
             data-tracking_url="<?php echo esc_attr( $carrier_url ) ?>"
             data-carrier_name="<?php echo esc_attr( $carrier_name ) ?>"
             data-digital_delivery="<?php echo esc_attr( $digital_delivery ) ?>"
             data-item_name="<?php echo esc_attr( $item_name ) ?>"
             data-item_sku="<?php echo esc_attr( $sku ) ?>"
             data-quantity_index="<?php echo esc_attr( $quantity_index ) ?>"
             data-item_id="<?php echo esc_attr( $item_id ) ?>"
             data-order_id="<?php echo esc_attr( $order_id ) ?>"
			<?php if ( $tracking_status ) {
				echo 'data-tooltip="' . esc_attr( isset( $current_tracking_data['status'] )
						? self::$settings->get_status_text_by_service_carrier( $current_tracking_data['status'] ) : '' ) . '"';
			} ?>>
			<?php echo wp_kses_post( $tracking_html ); ?>
        </div>
		<?php
	}

	/**
	 * @throws Exception
	 */
	public function send_tracking_email() {
		$response     = array(
			'status'          => 'error',
			'message'         => '',
			'message_content' => '',
		);
		$action_nonce = isset( $_POST['action_nonce'] ) ? sanitize_text_field( wp_unslash( $_POST['action_nonce'] ) ) : '';
		if ( ! wp_verify_nonce( $action_nonce, 'vi_wot_item_action_nonce' ) ) {
			$response['message'] = sprintf( esc_html__( 'missing nonce', 'woocommerce-orders-tracking' ) );
			wp_send_json( $response );
		}
		$order_id = isset( $_POST['order_id'] ) ? sanitize_text_field( $_POST['order_id'] ) : '';
		if ( ! current_user_can( 'edit_post', $order_id ) ) {
			$response['message'] = esc_html__( 'Sorry, you are not allowed to edit this order.', 'woocommerce-orders-tracking' );
			wp_send_json( $response );
		}
		if ( $order_id ) {
			$send_email = VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_EMAIL::send_email( $order_id, array(), true );
			if ( $send_email ) {
				$response['status']  = 'success';
				$response['message'] = sprintf( esc_html__( '#%s: Tracking email sent', 'woocommerce-orders-tracking' ), $order_id );// phpcs:ignore WordPress.WP.I18n.MissingTranslatorsComment
			}
		} else {
			$response['message'] = sprintf( esc_html__( '#%s: Error sending email', 'woocommerce-orders-tracking' ), $order_id );// phpcs:ignore WordPress.WP.I18n.MissingTranslatorsComment
		}

		wp_send_json( $response );
	}

	/**
	 * @param        $tracking_number
	 * @param        $carrier_slug
	 * @param        $status
	 * @param string $change_order_status
	 *
	 * @throws Exception
	 */
	public static function update_order_items_tracking_status( $tracking_number, $carrier_slug, $status, $change_order_status = '' ) {
		$results = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::search_order_item_by_tracking_number( $tracking_number, '', '', $carrier_slug, false );
		$now     = time();
		if ( count( $results ) ) {
			$order_ids         = array_unique( array_column( $results, 'order_id' ) );
			$changed_order_ids = array();
			$order_item_ids    = array();
			foreach ( $results as $result ) {
				if ( $result['order_item_id'] ) {
					$item_tracking_data = vi_wot_json_decode( $result['meta_value'] );
					if ( $result['meta_key'] === '_vi_wot_order_item_tracking_data' ) {
						$order_item_ids[]                     = $result['order_item_id'];
						$current_tracking_data                = array_pop( $item_tracking_data );
						$current_tracking_data['status']      = $status;
						$current_tracking_data['last_update'] = $now;
						$item_tracking_data[]                 = $current_tracking_data;
						wc_update_order_item_meta( $result['order_item_id'], '_vi_wot_order_item_tracking_data', vi_wot_json_encode( $item_tracking_data ) );
					} elseif ( $result['meta_key'] === '_vi_wot_order_item_tracking_data_by_quantity' ) {
						foreach ( $item_tracking_data as $quantity_index => &$current_tracking_data ) {
							if ( $current_tracking_data['tracking_number'] == $tracking_number && $current_tracking_data['carrier_slug'] === $carrier_slug ) {
								$order_item_ids[]                     = $result['order_item_id'] . '_' . $quantity_index;
								$current_tracking_data['status']      = $status;
								$current_tracking_data['last_update'] = $now;
							}
						}
						wc_update_order_item_meta( $result['order_item_id'], '_vi_wot_order_item_tracking_data_by_quantity', vi_wot_json_encode( $item_tracking_data ) );
					}
				} else {
					$changed_order_ids[] = $result['order_id'];
					$order_t             = wc_get_order( $result['order_id'] );
					$order_t->update_meta_data( '_wot_tracking_status', $status );
					$order_t->save_meta_data();
				}
			}
			$changed_order_ids = array_unique( $changed_order_ids );
			$order_item_ids    = array_unique( $order_item_ids );
			$convert_status    = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::convert_status( $status );
			self::update_order_status( $convert_status, $order_ids, $order_item_ids, $change_order_status, 'delivered', $changed_order_ids );
			$log = '';
			do_action_ref_array( 'woo_orders_tracking_handle_shipment_status', array(
				$tracking_number,
				$status,
				$order_ids,
				$order_item_ids,
				&$log,
				self::$settings->get_params( 'service_carrier_type' ),
				$changed_order_ids,
			) );
		}
	}

	/**
	 * Update order status when shipment statuses of all tracking numbers of an order change to a specific status
	 *
	 * Do not move this function to an other class as it's called statically in customers' custom works
	 *
	 * @param        $status
	 * @param        $order_ids
	 * @param        $order_item_ids
	 * @param        $change_order_status
	 * @param string $shipment_status
	 * @param        $changed_order_ids
	 *
	 * @return array
	 * @throws Exception
	 */
	public static function update_order_status( $status, $order_ids, $order_item_ids, $change_order_status, $shipment_status = 'delivered', $changed_order_ids = array() ) {
		$changed_orders = array();
		if ( $status === $shipment_status && $change_order_status ) {
			foreach ( $order_ids as $order_id ) {
				$order = wc_get_order( $order_id );
				if ( $order ) {
					$line_items                   = $order->get_items();
					$order_shipment_status_change = false;
					if ( in_array( $order_id, $changed_order_ids ) ) {
						$order_shipment_status_change = true;
					} else {
						if ( $order->get_meta( '_wot_tracking_number', true ) && $order->get_meta( '_wot_tracking_carrier', true ) ) {
							$order_shipment_status = $order->get_meta( '_wot_tracking_status', true );
							if ( $order_shipment_status ) {
								$order_shipment_status = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::convert_status( $order_shipment_status );
								if ( $order_shipment_status === $shipment_status ) {
									$order_shipment_status_change = true;
								}
							}
						}
					}
					if ( count( $line_items ) ) {
						$shipment_status_count = 0;
						$tracking_fields_count = 0;
						foreach ( $line_items as $item_id => $line_item ) {
							$tracking_fields_count ++;
							if ( ! in_array( $item_id, $order_item_ids ) ) {
								$item_tracking_data = $line_item->get_meta( '_vi_wot_order_item_tracking_data', true );
								if ( $item_tracking_data ) {
									$item_tracking_data    = vi_wot_json_decode( $item_tracking_data );
									$current_tracking_data = array_pop( $item_tracking_data );
									$tracking_status       = isset( $current_tracking_data['status'] )
										? VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::convert_status( $current_tracking_data['status'] ) : '';
									if ( $tracking_status === $shipment_status ) {
										$shipment_status_count ++;
									}
								} else {
									if ( $order_shipment_status_change ) {
										$shipment_status_count ++;
									}
								}
								$quantity = $line_item->get_quantity();
								if ( $quantity > 1 ) {
									$item_tracking_data = $line_item->get_meta( '_vi_wot_order_item_tracking_data_by_quantity', true );
									if ( $item_tracking_data ) {
										$item_tracking_data = vi_wot_json_decode( $item_tracking_data );
										for ( $i = 0; $i < $quantity - 1; $i ++ ) {
											if ( isset( $item_tracking_data[ $i ] ) ) {
												$tracking_fields_count ++;
												if ( ! in_array( $item_id . '_' . $i, $order_item_ids ) ) {
													$current_tracking_data = $item_tracking_data[ $i ];
													$tracking_status       = isset( $current_tracking_data['status'] )
														? VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::convert_status( $current_tracking_data['status'] ) : '';
													if ( $tracking_status === $shipment_status ) {
														$shipment_status_count ++;
													}
												} else {
													$shipment_status_count ++;
												}
											}
										}
									}
								}
							} else {
								$shipment_status_count ++;
							}
						}
						if ( apply_filters( "vi_woo_orders_tracking_is_order_{$shipment_status}", ( $shipment_status_count === $tracking_fields_count ), $order, $change_order_status ) ) {
							$update_status = substr( $change_order_status, 3 );
							if ( $update_status !== $order->get_status() ) {
								$changed_orders[] = $order_id;
								$order->update_status( $update_status );
							}
						}
					}
				}
			}
		}

		return $changed_orders;
	}

	/**
	 * @param bool $update ;
	 * @param WC_Order $order ;
	 * @param string $change_order_status ;
	 */
	public function woo_orders_tracking_is_order_delivered( $update, $order, $change_order_status ) {
		if ( $change_order_status === 'wc-completed' && in_array( 'wc-' . $order->get_status(), (array) self::$settings->get_params( 'change_order_exclude_status' ) ) ) {
			$update = false;
		}

		return $update;
	}

	/**
	 * Refresh tracking numbers list after saving + save send email, send sms, add to PayPal, change order status options
	 */
	public function refresh_tracking_number_column() {
		$action_nonce = isset( $_GET['action_nonce'] ) ? sanitize_text_field( wp_unslash( $_GET['action_nonce'] ) ) : '';
		if ( ! wp_verify_nonce( $action_nonce, 'vi_wot_item_action_nonce' ) ) {
			return;
		}
		$order_id = isset( $_GET['order_id'] ) ? sanitize_text_field( wp_unslash( $_GET['order_id'] ) ) : '';
		if ( ! current_user_can( 'edit_post', $order_id ) ) {
			wp_die( esc_html__( 'Sorry, you are not allowed to edit this order.', 'woocommerce-orders-tracking' ) );
		}
		$update_settings     = isset( $_GET['update_settings'] ) ? sanitize_text_field( wp_unslash( $_GET['update_settings'] ) ) : '';
		$change_order_status = isset( $_GET['change_order_status'] ) ? sanitize_text_field( wp_unslash( $_GET['change_order_status'] ) ) : '';
		$send_email          = isset( $_GET['send_email'] ) ? sanitize_text_field( wp_unslash( $_GET['send_email'] ) ) : '';
		$send_sms            = isset( $_GET['send_sms'] ) ? sanitize_text_field( wp_unslash( $_GET['send_sms'] ) ) : '';
		$paypal_enable       = isset( $_GET['paypal_enable'] ) ? sanitize_text_field( wp_unslash( $_GET['paypal_enable'] ) ) : '';
		$response            = array(
			'status'  => 'error',
			'message' => '',
			'html'    => '',
		);
		if ( $order_id && wp_verify_nonce( $action_nonce, 'vi_wot_item_action_nonce' ) ) {
			if ( $update_settings ) {
				if ( $change_order_status != self::$settings->get_params( 'order_status' ) ||
				     $paypal_enable != self::$settings->get_params( 'paypal_enable' ) ||
				     $send_email != self::$settings->get_params( 'email_enable' ) ||
				     $send_sms != self::$settings->get_params( 'sms_enable' )
				) {
					$settings                  = self::$settings->get_params();
					$settings['order_status']  = $change_order_status;
					$settings['email_enable']  = $send_email;
					$settings['sms_enable']    = $send_sms;
					$settings['paypal_enable'] = $paypal_enable;
					update_option( 'woo_orders_tracking_settings', $settings );
				}
			}
			ob_start();
			$this->tracking_number_column_html( $order_id );
			$html = ob_get_clean();
			if ( $html ) {
				$response['status'] = 'success';
				$response['html']   = $html;
			}
		} else {
			$response['message'] = esc_html__( 'Invalid data', 'woocommerce-orders-tracking' );
		}
		wp_send_json( $response );
	}

	/**
	 * Get the latest shipment data of a tracking number
	 * For tracking services that use API
	 *
	 * @throws Exception
	 */
	public function refresh_track_info() {
		$response        = array(
			'status'                   => 'success',
			'message'                  => esc_html__( 'Update tracking data successfully.', 'woocommerce-orders-tracking' ),
			'message_content'          => '',
			'tracking_change'          => 0,
			'tracking_status'          => '',
			'tracking_container_class' => '',
			'button_title'             => sprintf( esc_html__( 'Last update: %s. Click to refresh.', 'woocommerce-orders-tracking' ), date_i18n( 'Y-m-d H:i:s', time() ) ),// phpcs:ignore WordPress.WP.I18n.MissingTranslatorsComment
		);
		$tracking_number = isset( $_POST['tracking_number'] ) ? sanitize_text_field( $_POST['tracking_number'] ) : '';
		$carrier_slug    = isset( $_POST['carrier_slug'] ) ? sanitize_text_field( $_POST['carrier_slug'] ) : '';
		$order_id        = isset( $_POST['order_id'] ) ? sanitize_text_field( stripslashes( $_POST['order_id'] ) ) : '';
		if ( ! current_user_can( 'edit_post', $order_id ) ) {
			wp_die( esc_html__( 'Sorry, you are not allowed to edit this order.', 'woocommerce-orders-tracking' ) );
		}
		$order = wc_get_order( $order_id );
		if ( $order && $tracking_number && $carrier_slug && self::$settings->get_params( 'service_carrier_enable' ) ) {
			$response['message_content'] = '<div>' . sprintf( esc_html__( 'Tracking number: %s', 'woocommerce-orders-tracking' ), $tracking_number ) . '</div>';// phpcs:ignore WordPress.WP.I18n.MissingTranslatorsComment
			$carrier                     = self::$settings->get_shipping_carrier_by_slug( $carrier_slug );
			if ( is_array( $carrier ) && count( $carrier ) ) {
				$status                      = '';
				$convert_status              = '';
				$carrier_name                = $carrier['name'];
				$tracking_more_slug          = empty( $carrier['tracking_more_slug'] ) ? VI_WOOCOMMERCE_ORDERS_TRACKING_TRACKINGMORE::get_carrier_slug_by_name( $carrier_name )
					: $carrier['tracking_more_slug'];
				$response['message_content'] .= '<div>' . sprintf( esc_html__( 'Carrier: %s', 'woocommerce-orders-tracking' ), $carrier_name ) . '</div>';// phpcs:ignore WordPress.WP.I18n.MissingTranslatorsComment
				$service_carrier_type        = self::$settings->get_params( 'service_carrier_type' );
				$change_order_status         = self::$settings->get_params( 'change_order_status' );
				switch ( $service_carrier_type ) {
					case 'trackingmore':
						$tracking_from_db        = VI_WOOCOMMERCE_ORDERS_TRACKING_TRACKINGMORE_TABLE::get_row_by_tracking_number( $tracking_number, $carrier_slug, $order_id );
						$service_carrier_api_key = self::$settings->get_params( 'service_carrier_api_key' );
						$trackingMore            = new VI_WOOCOMMERCE_ORDERS_TRACKING_TRACKINGMORE( $service_carrier_api_key );
						$description             = '';
						$track_info              = '';
						if ( ! count( $tracking_from_db ) ) {
							$track_data = $trackingMore->create_tracking( $tracking_number, $tracking_more_slug, $order_id );
							if ( $track_data['status'] === 'success' ) {
								$status = $track_data['data']['status'];
								VI_WOOCOMMERCE_ORDERS_TRACKING_TRACKINGMORE_TABLE::insert( $order_id, $tracking_number, $status, $carrier_slug, $carrier_name,
									VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_shipping_country_by_order_id( $order_id ), $track_info, '' );
							} else {
								if ( $track_data['code'] === 4016 ) {
									/*Tracking exists*/
									$track_data  = $trackingMore->get_tracking( $tracking_number, $tracking_more_slug );
									$modified_at = '';
									if ( $track_data['status'] === 'success' ) {
										if ( count( $track_data['data'] ) ) {
											$track_info  = vi_wot_json_encode( $track_data['data'] );
											$last_event  = array_shift( $track_data['data'] );
											$status      = $last_event['status'];
											$description = $last_event['description'];
											$modified_at = false;
										}
									} else {
										$response['status']  = 'error';
										$response['message'] = $track_data['data'];
									}
									VI_WOOCOMMERCE_ORDERS_TRACKING_TRACKINGMORE_TABLE::insert( $order_id, $tracking_number, $status, $carrier_slug, $carrier_name,
										VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_shipping_country_by_order_id( $order_id ), $track_info, $description, $modified_at );
								} else {
									$response['status']  = 'error';
									$response['message'] = $track_data['data'];
								}
							}
						} else {
							$need_update_tracking_table = true;
							$convert_status             = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::convert_status( $tracking_from_db['status'] );
							if ( $convert_status !== 'delivered' ) {
								$track_data = $trackingMore->get_tracking( $tracking_number, $tracking_more_slug );
								if ( $track_data['status'] === 'success' ) {
									if ( count( $track_data['data'] ) ) {
										$need_update_tracking_table = false;
										$track_info                 = vi_wot_json_encode( $track_data['data'] );
										$last_event                 = array_shift( $track_data['data'] );
										$status                     = $last_event['status'];
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
											$status = $track_data['data']['status'];
											VI_WOOCOMMERCE_ORDERS_TRACKING_TRACKINGMORE_TABLE::insert( $order_id, $tracking_number, $status, $carrier_slug, $carrier_name,
												VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_shipping_country_by_order_id( $order_id ), $track_info, '' );
										}
									} else {
										$response['status']  = 'error';
										$response['message'] = $track_data['data'];
									}
								}
							} else {
								$status = $tracking_from_db['status'];
							}

							if ( $need_update_tracking_table ) {
								if ( $order_id != $tracking_from_db['order_id'] ) {
									VI_WOOCOMMERCE_ORDERS_TRACKING_TRACKINGMORE_TABLE::update( $tracking_from_db['id'], $order_id, $status, $carrier_slug, $carrier_name,
										VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_shipping_country_by_order_id( $order_id ), $track_info, $description );
								} else {
									VI_WOOCOMMERCE_ORDERS_TRACKING_TRACKINGMORE_TABLE::update( $tracking_from_db['id'], '', false, false, false, false, false, false, '' );
								}
							}
						}
						break;
					case 'aftership':
						$tracking_from_db        = VI_WOOCOMMERCE_ORDERS_TRACKING_TRACK_INFO_TABLE::get_row_by_tracking_number( $tracking_number, $carrier_slug,
							$service_carrier_type, $order_id );
						$service_carrier_api_key = self::$settings->get_params( 'service_carrier_api_key' );
						$find_carrier            = VI_WOOCOMMERCE_ORDERS_TRACKING_AFTERSHIP::get_carrier_slug_by_name( $carrier_name );
						$aftership               = new VI_WOOCOMMERCE_ORDERS_TRACKING_AFTERSHIP( $service_carrier_api_key );
						$description             = '';
						$track_info              = '';
						if ( ! count( $tracking_from_db ) ) {
							$track_data = $aftership->create( $tracking_number, $find_carrier, $order_id );
							if ( $track_data['status'] === 'success' ) {
								$status = $track_data['data']['tag'];
								VI_WOOCOMMERCE_ORDERS_TRACKING_TRACK_INFO_TABLE::insert( $tracking_number, $order_id, $carrier_slug, $service_carrier_type, $status, '', '',
									$track_data['est_delivery_date'] );
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
											$track_info  = vi_wot_json_encode( $track_data['data'] );
											$last_event  = array_shift( $track_data['data'] );
											$status      = $last_event['status'];
											$description = $last_event['description'];
										}
									} else {
										$response['status']  = 'error';
										$response['message'] = $track_data['data'];
									}
									VI_WOOCOMMERCE_ORDERS_TRACKING_TRACK_INFO_TABLE::insert( $tracking_number, $order_id, $carrier_slug, $service_carrier_type, $status,
										$track_info, $description, '', '' );
								} else {
									$response['status']  = 'error';
									$response['message'] = $track_data['data'];
								}
							}
						} else {
							$need_update_tracking_table = true;
							$convert_status             = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::convert_status( $tracking_from_db['status'] );
							if ( $convert_status !== 'delivered' ) {
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
										$need_update_tracking_table = false;
										$track_info                 = vi_wot_json_encode( $track_data['data'] );
										$last_event                 = array_shift( $track_data['data'] );
										$status                     = $last_event['status'];
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
											$response['status']  = 'error';
											$response['message'] = $track_data['data'];
										}
									} else {
										$response['status']  = 'error';
										$response['message'] = $track_data['data'];
									}
								}
							} else {
								$status = $tracking_from_db['status'];
							}

							if ( $need_update_tracking_table && $order_id != $tracking_from_db['order_id'] || $service_carrier_type !== $tracking_from_db['carrier_service'] ) {
								VI_WOOCOMMERCE_ORDERS_TRACKING_TRACK_INFO_TABLE::update( $tracking_from_db['id'], $order_id, $carrier_slug, $service_carrier_type );
							}
						}
						break;
					case '17track':
						$tracking_from_db        = VI_WOOCOMMERCE_ORDERS_TRACKING_TRACK_INFO_TABLE::get_row_by_tracking_number( $tracking_number, $carrier_slug,
							$service_carrier_type, $order_id );
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
								$response['status']  = 'error';
								$response['message'] = $track_data['data'];
							}
						} else {
							$need_update_tracking_table = true;
							if ( VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::convert_status( $tracking_from_db['status'] ) !== 'delivered' ) {
								$track_data = $_17track->get_tracking_data( $tracking_number, $carrier_name );
								if ( $track_data['status'] === 'success' ) {
									if ( count( $track_data['data'] ) ) {
										$need_update_tracking_table = false;
										$track_info                 = vi_wot_json_encode( $track_data['data'] );
										$last_event                 = array_shift( $track_data['data'] );
										$status                     = $last_event['status'];
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
											$response['status']  = 'error';
											$response['message'] = $track_data['data'];
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
										$response['status']  = 'error';
										$response['message'] = $track_data['data'];
									}
								}
							} else {

							}

							if ( $need_update_tracking_table && $order_id != $tracking_from_db['order_id'] || $service_carrier_type !== $tracking_from_db['carrier_service'] ) {
								VI_WOOCOMMERCE_ORDERS_TRACKING_TRACK_INFO_TABLE::update( $tracking_from_db['id'], $order_id, $carrier_slug, $service_carrier_type );
							}
						}
						break;
					case 'tracktry':
						$tracking_from_db        = VI_WOOCOMMERCE_ORDERS_TRACKING_TRACK_INFO_TABLE::get_row_by_tracking_number( $tracking_number, $carrier_slug,
							$service_carrier_type, $order_id );
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
								$response['status']  = 'error';
								$response['message'] = $track_data['data'];
							}
						} else {
							$need_update_tracking_table = true;
							if ( VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::convert_status( $tracking_from_db['status'] ) !== 'delivered' ) {
								$track_data = $tracktry->get_tracking_data( $tracking_number, $carrier_name );
								if ( $track_data['status'] === 'success' ) {
									if ( count( $track_data['data'] ) ) {
										$need_update_tracking_table = false;
										$track_info                 = vi_wot_json_encode( $track_data['data'] );
										$last_event                 = array_shift( $track_data['data'] );
										$status                     = $last_event['status'];
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
											$response['status']  = 'error';
											$response['message'] = $track_data['data'];
										}
									} elseif ( $track_data['code'] == 4032 ) {
										/*Tracking carrier not correct*/
										if ( $carrier_name !== $track_data['carrier_name'] ) {

										}
									} else {
										$response['status']  = 'error';
										$response['message'] = $track_data['data'];
									}
								}
							} else {

							}

							if ( $need_update_tracking_table && $order_id != $tracking_from_db['order_id'] || $service_carrier_type !== $tracking_from_db['carrier_service'] ) {
								VI_WOOCOMMERCE_ORDERS_TRACKING_TRACK_INFO_TABLE::update( $tracking_from_db['id'], $order_id, $carrier_slug, $service_carrier_type );
							}
						}
						break;
					case 'easypost':
						$tracking_from_db        = VI_WOOCOMMERCE_ORDERS_TRACKING_TRACK_INFO_TABLE::get_row_by_tracking_number( $tracking_number, $carrier_slug,
							$service_carrier_type, $order_id );
						$service_carrier_api_key = self::$settings->get_params( 'service_carrier_api_key' );
						$find_carrier            = VI_WOOCOMMERCE_ORDERS_TRACKING_EASYPOST::get_carrier_slug_by_name( $carrier_name );
						$easyPost                = new VI_WOOCOMMERCE_ORDERS_TRACKING_EASYPOST( $service_carrier_api_key );
						if ( ! count( $tracking_from_db ) ) {
							$track_data = $easyPost->create( $tracking_number, $find_carrier );
							if ( $track_data['status'] === 'success' ) {
								if ( count( $track_data['data'] ) ) {
									$track_info = vi_wot_json_encode( $track_data['data'] );
									$last_event = array_shift( $track_data['data'] );
									$status     = $last_event['status'];
									VI_WOOCOMMERCE_ORDERS_TRACKING_TRACK_INFO_TABLE::insert( $tracking_number, $order_id, $carrier_slug, $service_carrier_type, $status,
										$track_info, $last_event['description'], $track_data['est_delivery_date'] );
								}
							} else {
								$response['status']  = 'error';
								$response['message'] = $track_data['data'];
							}
						} else {
							$need_update_tracking_table = true;
							$convert_status             = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::convert_status( $tracking_from_db['status'] );
							if ( $convert_status !== 'delivered' ) {
								$track_data = $easyPost->retrieve( $tracking_number );
								if ( $track_data['status'] === 'success' ) {
									if ( count( $track_data['data'] ) ) {
										$need_update_tracking_table = false;
										$track_info                 = vi_wot_json_encode( $track_data['data'] );
										$last_event                 = array_shift( $track_data['data'] );
										$status                     = $last_event['status'];
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
												VI_WOOCOMMERCE_ORDERS_TRACKING_TRACK_INFO_TABLE::insert( $tracking_number, $order_id, $carrier_slug, $service_carrier_type, $status,
													$track_info, $last_event['description'], $track_data['est_delivery_date'] );
											}
										} else {
											$response['status']  = 'error';
											$response['message'] = $track_data['data'];
										}
									} else {
										$response['status']  = 'error';
										$response['message'] = $track_data['data'];
									}
								}
							} else {
								$status = $tracking_from_db['status'];
							}
							if ( $need_update_tracking_table && $order_id != $tracking_from_db['order_id'] || $service_carrier_type !== $tracking_from_db['carrier_service'] ) {
								VI_WOOCOMMERCE_ORDERS_TRACKING_TRACK_INFO_TABLE::update( $tracking_from_db['id'], $order_id, $carrier_slug, $service_carrier_type );
							}
						}

						break;
					default:
				}
				self::update_order_items_tracking_status( $tracking_number, $carrier_slug, $status, $change_order_status );
				if ( $status ) {
					$convert_status                       = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::convert_status( $status );
					$response['message_content']          .= '<div>' . self::$settings->get_status_text_by_service_carrier( $status ) . '</div>';
					$response['tracking_container_class'] = self::set( array(
						'tracking-number-container',
						'tracking-number-container-' . $convert_status
					) );
				}
				$response['tracking_status'] = $convert_status;
			} else {
				$response['status']  = 'error';
				$response['message'] = esc_html__( 'Carrier not found', 'woocommerce-orders-tracking' );
			}
		} else {
			$response['status']  = 'error';
			$response['message'] = esc_html__( 'Not available', 'woocommerce-orders-tracking' );
		}
		wp_send_json( $response );
	}

	/**
	 * Search tracking number field
	 */
	public function restrict_manage_posts() {
		global $typenow;
		if ( in_array( $typenow, wc_get_order_types( 'view-orders' ), true ) || ( wc_clean( wp_unslash( $_GET['page'] ?? '' ) ) === 'wc-orders' ) ) {
			?>
            <input type="text" name="woo_orders_tracking_search_tracking"
                   placeholder="<?php echo esc_attr__( 'Search tracking number', 'woocommerce-orders-tracking' ) ?>"
                   autocomplete="off"
                   value="<?php echo esc_attr( isset( $_GET['woo_orders_tracking_search_tracking'] ) ? htmlentities( sanitize_text_field( $_GET['woo_orders_tracking_search_tracking'] ) ) : '' ) ?>">
			<?php
		}
	}

	/**
	 * Join needed tables to search for a tracking number
	 *
	 * @param $join
	 * @param $wp_query
	 *
	 * @return string
	 */
	public function posts_join( $join, $wp_query ) {
		global $wpdb;
		$join .= " JOIN {$wpdb->prefix}woocommerce_order_items as wotg_woocommerce_order_items ON $wpdb->posts.ID=wotg_woocommerce_order_items.order_id";
		$join .= " JOIN {$wpdb->prefix}woocommerce_order_itemmeta as wotg_woocommerce_order_itemmeta ON wotg_woocommerce_order_items.order_item_id=wotg_woocommerce_order_itemmeta.order_item_id";
		$join .= " JOIN {$wpdb->prefix}postmeta ON $wpdb->postmeta.post_id=$wpdb->posts.ID";

		return $join;
	}

	/**
	 * Add where conditions when searching for a tracking number
	 *
	 * @param $where
	 * @param $wp_query WP_Query
	 *
	 * @return string
	 */
	public function posts_where( $where, $wp_query ) {
		global $wpdb;
		$post_type     = isset( $wp_query->query_vars['post_type'] ) ? $wp_query->query_vars['post_type'] : '';
		$tracking_code = isset( $_GET['woo_orders_tracking_search_tracking'] ) ? $_GET['woo_orders_tracking_search_tracking'] : '';
		if ( isset( $_GET['filter_action'] ) && $tracking_code && $post_type === 'shop_order' ) {
			$where .= $wpdb->prepare( " AND ((wotg_woocommerce_order_itemmeta.meta_key='_vi_wot_order_item_tracking_data' AND wotg_woocommerce_order_itemmeta.meta_value like %s) or ($wpdb->postmeta.meta_key='_wot_tracking_number' AND $wpdb->postmeta.meta_value=%s))",
				'%' . $wpdb->esc_like( $tracking_code ) . '%', $tracking_code );
			add_filter( 'posts_join', array( $this, 'posts_join' ), 10, 2 );
			add_filter( 'posts_distinct', array( $this, 'posts_distinct' ), 10, 2 );
		}

		return $where;
	}

	public function add_items_query( $args ) {
		if ( isset( $_GET['page'] ) && sanitize_text_field( wp_unslash( $_GET['page'] ) ) === 'wc-orders' && ! empty( $_GET['woo_orders_tracking_search_tracking'] ) ) {
			$tracking_code = sanitize_text_field( wp_unslash( $_GET['woo_orders_tracking_search_tracking'] ) );
			global $wpdb;
			$args['join']  .= " LEFT JOIN {$wpdb->prefix}wc_orders_meta ON {$wpdb->prefix}wc_orders.id={$wpdb->prefix}wc_orders_meta.order_id";
			$args['join']  .= " LEFT JOIN {$wpdb->prefix}woocommerce_order_items ON {$wpdb->prefix}wc_orders.id={$wpdb->prefix}woocommerce_order_items.order_id";
			$args['join']  .= " LEFT JOIN {$wpdb->prefix}woocommerce_order_itemmeta ON {$wpdb->prefix}woocommerce_order_items.order_item_id={$wpdb->prefix}woocommerce_order_itemmeta.order_item_id";
			$args['where'] .= $wpdb->prepare( " AND (({$wpdb->prefix}woocommerce_order_itemmeta.meta_key='_vi_wot_order_item_tracking_data' AND {$wpdb->prefix}woocommerce_order_itemmeta.meta_value like %s) or ({$wpdb->prefix}wc_orders_meta.meta_key='_wot_tracking_number' AND {$wpdb->prefix}wc_orders_meta.meta_value=%s))",
				'%' . $wpdb->esc_like( $tracking_code ) . '%', $tracking_code );
		}

		return $args;
	}

	/**
	 * @param $join
	 * @param $wp_query
	 *
	 * @return string
	 */
	public function posts_distinct( $join, $wp_query ) {
		return 'DISTINCT';
	}
}