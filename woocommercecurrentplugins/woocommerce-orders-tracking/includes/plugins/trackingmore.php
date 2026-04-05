<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
/**
 * TrackingMore - WooCommerce Tracking
 */
if ( ! class_exists( 'VI_WOOCOMMERCE_ORDERS_TRACKING_PLUGINS_Trackingmore' ) ) {
	class VI_WOOCOMMERCE_ORDERS_TRACKING_PLUGINS_Trackingmore {
        protected static $settings;
		public function __construct() {
			if ( !is_plugin_active( 'trackingmore-woocommerce-tracking/trackingmore.php' ) ) {
                return;
			}
            self::$settings = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_instance();
			add_action( 'admin_enqueue_scripts', array( $this, 'admin_enqueue_scripts' ) );
			add_action( 'admin_init', array( $this, 'render_tracking_imported_by_trackingmore' ) );
			add_action( 'viwot_notices', array( $this, 'print_notice' ) );
		}
		public function admin_enqueue_scripts() {
			$page = isset( $_GET['page'] ) ? sanitize_text_field( wp_unslash( $_GET['page'] )) : '';// phpcs:ignore WordPress.Security.NonceVerification.Recommended
			if ( $page === 'trackingmore-setting-admin' ) {
				$trackingmore_option_name = get_option( 'trackingmore_option_name' );
				wp_enqueue_script( 'woo-orders-tracking-mapping-couriers', VI_WOOCOMMERCE_ORDERS_TRACKING_JS . 'mapping-couriers.js', array( 'jquery' ), VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION , false );
				wp_localize_script( 'woo-orders-tracking-mapping-couriers', 'woo_orders_tracking_mapping_couriers', array(
					'couriers_title' =>esc_html__('TrackingMore courier','woocommerce-orders-tracking') ,
					'couriers_mapping_name' =>'trackingmore_courier_mapping' ,
					'couriers_mapping' => self::$settings->get_params( 'trackingmore_courier_mapping' ),
					'carriers'                   => VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_carriers(),
					'couriers'        => empty( $trackingmore_option_name['couriers'] ) ? array() : explode( ',', $trackingmore_option_name['couriers'] ),
				) );
			}
		}
		public function print_notice(){
			if ( ! get_transient( 'viwot_render_tracking_imported_by_trackingmore' )  ) {
				?>
				<div class="notice notice-warning inline">
                    <p>
                        <?php esc_html_e( 'Your site is using TrackingMore - WooCommerce Tracking Plugin, tracking information imported by this plugin are not displayed properly with WooCommerce Orders Tracking plugin.', 'woocommerce-orders-tracking' ) ; ?>
                    </p>
                    <?php
                    if (self::$settings->get_params('trackingmore_courier_mapping')){
                        echo wp_kses_post(sprintf(__('<p><a href="%s">Update tracking information now</a> or <a href="%s">Hide</a></p>','woocommerce-orders-tracking'),// phpcs:ignore WordPress.WP.I18n.MissingTranslatorsComment, WordPress.WP.I18n.UnorderedPlaceholdersText, WordPress.WP.I18n.NoHtmlWrappedStrings
                            add_query_arg( array( 'viwot_trackingmore' => 'update' ) ), add_query_arg( array( 'viwot_trackingmore' => 'hide' ) )));
                    }else{
	                    echo wp_kses_post(sprintf(__('<p><a href="%s">Mapping shipping company before updating tracking information</a> or <a href="%s">Hide</a></p>','woocommerce-orders-tracking'),// phpcs:ignore WordPress.WP.I18n.MissingTranslatorsComment, WordPress.WP.I18n.UnorderedPlaceholdersText, WordPress.WP.I18n.NoHtmlWrappedStrings
                            admin_url( 'admin.php?page=trackingmore-setting-admin&viwot_trackingmore=mapping'  ), add_query_arg( array( 'viwot_trackingmore' => 'hide' ) )));
                    }
                    ?>
                </div>
				<?php
			}
		}
        public function render_tracking_imported_by_trackingmore(){
	        $option_page = isset( $_POST['option_page'] ) ? sanitize_text_field( wp_unslash( $_POST['option_page']) ) : '';
	        $action      = isset( $_POST['action'] ) ? sanitize_text_field( wp_unslash( $_POST['action'] )) : '';
	        if ( $option_page === 'trackingmore_option_group' && $action === 'update' && isset( $_POST['trackingmore_courier_mapping'] ) ) {
		        $courier_mapping           = isset( $_POST['trackingmore_courier_mapping'] ) ? wc_clean(wp_unslash( $_POST['trackingmore_courier_mapping'] )) : array();
		        $params                               = self::$settings->get_params();
		        $params['trackingmore_courier_mapping'] = $courier_mapping;
		        update_option( 'woo_orders_tracking_settings', $params );
                self::$settings = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_instance(true);
	        }
	        if ( !isset( $_GET['viwot_trackingmore'] ) ) {
                return;
	        }
            $action = sanitize_text_field(wp_unslash( $_GET['viwot_trackingmore'] ));
            switch ($action){
                case 'update':
                    if (empty(self::$settings->get_params('trackingmore_courier_mapping'))) {
	                    wp_safe_redirect( admin_url( 'admin.php?page=trackingmore-setting-admin&viwot_trackingmore=mapping'  ) );
	                    exit();
                    }
	                $sync = true;
                    break;
                case 'mapping':
	                if (empty(self::$settings->get_params('trackingmore_courier_mapping'))) {
                        break;
	                }
                    $sync = true;
                    break;
                case 'hide':
	                set_transient( 'viwot_render_tracking_imported_by_trackingmore', current_time( 'timestamp' ) );
                    break;
            }
            if (!empty($sync)){
                $orders = wc_get_orders(array(
                        'meta_key'=>'_trackingmore_tracking_number',// phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key
                        'meta_compare'=>'EXISTS',
                ));
                if (!empty($orders)){
                    foreach ($orders as $order){
                        $tracking_number = $order->get_meta('_trackingmore_tracking_number');
                        $carrier_slug = $order->get_meta('_trackingmore_tracking_provider');
                        $trackingmore_courier_mapping = self::$settings->get_params('trackingmore_courier_mapping');
                        if (!$tracking_number || !$carrier_slug || empty($trackingmore_courier_mapping[$carrier_slug])){
                            continue;
                        }
                        $carrier_slug = $trackingmore_courier_mapping[$carrier_slug];
	                    $order->update_meta_data( '_wot_tracking_number', $tracking_number );
	                    $order->update_meta_data( '_wot_tracking_carrier', $carrier_slug );
	                    $order->update_meta_data( '_wot_tracking_status', '' );
	                    $order->save_meta_data();
	                    do_action( 'woo_orders_tracking_updated_order_tracking_data', $order->get_id(), $tracking_number, self::$settings->get_shipping_carrier_by_slug( $carrier_slug ) );
                    }
                }
	            set_transient( 'viwot_render_tracking_imported_by_trackingmore', current_time( 'timestamp' ) );
	            if ($action === 'mapping') {
		            wp_safe_redirect( admin_url( 'admin.php?page=woocommerce-orders-tracking'  ) );
		            exit();
	            }
            }
        }
	}
}