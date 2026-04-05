<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class VI_WOOCOMMERCE_ORDERS_TRACKING_ADMIN_ADMIN {
	protected $settings;

	public function __construct() {
		$this->settings = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_instance();
		add_action( 'init', array( $this, 'init' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'update_data_new_version' ), 1 );
		add_filter(
			'plugin_action_links_woocommerce-orders-tracking/woocommerce-orders-tracking.php', array(
				$this,
				'settings_link'
			)
		);
	}

	public function update_data_new_version() {
		if ( ! get_option( 'woo_orders_tracking_update_data_new_version_1.0.8' ) ) {
			if ( get_option( 'woo_orders_tracking_settings' ) ) {
				$defined_carriers = $this->settings->get_params( 'shipping_carriers_define_list' );
				if ( $defined_carriers ) {
					$defined_carriers = vi_wot_json_decode( $defined_carriers );
					$update           = false;
					foreach ( $defined_carriers as $key => $value ) {
						if ( $value['slug'] === 'fedex' ) {
							if ( $defined_carriers[ $key ]['url'] !== 'https://www.fedex.com/fedextrack/?cntry_code=us&tracknumbers={tracking_number}' ) {
								$defined_carriers[ $key ]['url'] = 'https://www.fedex.com/fedextrack/?cntry_code=us&tracknumbers={tracking_number}';
								$update                          = true;
							}
						} elseif ( $value['slug'] === 'portugal-post-ctt' ) {
							if ( $defined_carriers[ $key ]['url'] !== 'https://www.ctt.pt/feapl_2/app/open/objectSearch/objectSearch.jspx?objects={tracking_number}' ) {
								$defined_carriers[ $key ]['url'] = 'https://www.ctt.pt/feapl_2/app/open/objectSearch/objectSearch.jspx?objects={tracking_number}';
								$update                          = true;
							}
						}
					}
					if ( $update ) {
						$params                                  = $this->settings->get_params();
						$params['shipping_carriers_define_list'] = vi_wot_json_encode( $defined_carriers );
						update_option( 'woo_orders_tracking_settings', $params );
						$this->settings = VI_WOOCOMMERCE_ORDERS_TRACKING_DATA::get_instance( true );
					}
				}
			}
			update_option( 'woo_orders_tracking_update_data_new_version_1.0.8', time() );
		}
	}

	public static function query_order_item_meta( $args1 = array(), $args2 = array(), $limit = 0 ) {
		global $wpdb;
		$sql  = "SELECT * FROM {$wpdb->prefix}woocommerce_order_items as woocommerce_order_items JOIN {$wpdb->prefix}woocommerce_order_itemmeta as woocommerce_order_itemmeta WHERE woocommerce_order_items.order_item_id=woocommerce_order_itemmeta.order_item_id";
		$args = array();
		if ( count( $args1 ) ) {
			foreach ( $args1 as $key => $value ) {
				if ( is_array( $value ) ) {
					$sql .= " AND woocommerce_order_items.{$key} IN (" . implode( ', ', array_fill( 0, count( $value ), '%s' ) ) . ")";
					foreach ( $value as $v ) {
						$args[] = $v;
					}
				} else {
					$sql    .= " AND woocommerce_order_items.{$key}='%s'";
					$args[] = $value;
				}
			}
		}
		if ( count( $args2 ) ) {
			foreach ( $args2 as $key => $value ) {
				if ( is_array( $value ) ) {
					$sql .= " AND woocommerce_order_itemmeta.{$key} IN (" . implode( ', ', array_fill( 0, count( $value ), '%s' ) ) . ")";
					foreach ( $value as $v ) {
						$args[] = $v;
					}
				} else {
					$sql    .= " AND woocommerce_order_itemmeta.{$key}='%s'";
					$args[] = $value;
				}
			}
		}
		if ( $limit ) {
			$sql .= " LIMIT 0,{$limit}";
		}
		$query      = $wpdb->prepare( $sql, $args );// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		$line_items = $wpdb->get_results( $query, ARRAY_A );// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared

		return $line_items;
	}

	public function settings_link( $links ) {
		$settings_link = '<a href="' . esc_url( admin_url( 'admin.php' ) ) . '?page=woocommerce-orders-tracking" title="' . esc_attr__( 'Settings', 'woocommerce-orders-tracking' ) . '">' . esc_html__( 'Settings', 'woocommerce-orders-tracking' ) . '</a>';
		array_unshift( $links, $settings_link );

		return $links;
	}

	public function load_plugin_textdomain() {
		$locale = apply_filters( 'plugin_locale', get_locale(), 'woocommerce-orders-tracking' );
		load_textdomain( 'woocommerce-orders-tracking', VI_WOOCOMMERCE_ORDERS_TRACKING_LANGUAGES . "woocommerce-orders-tracking-$locale.mo" );
		load_plugin_textdomain( 'woocommerce-orders-tracking', false, VI_WOOCOMMERCE_ORDERS_TRACKING_LANGUAGES );
	}

	public function init() {
		$this->load_plugin_textdomain();
		if ( class_exists( 'VillaTheme_Support_Pro' ) ) {
			new VillaTheme_Support_Pro(
				array(
					'support'   => 'https://villatheme.com/supports/forum/plugins/woocommerce-orders-tracking/',
					'docs'      => 'https://docs.villatheme.com/?item=woo-orders-tracking',
					'review'    => 'https://codecanyon.net/downloads',
					'css'       => VI_WOOCOMMERCE_ORDERS_TRACKING_CSS,
					'image'     => VI_WOOCOMMERCE_ORDERS_TRACKING_IMAGES,
					'slug'      => 'woocommerce-orders-tracking',
					'menu_slug' => 'woocommerce-orders-tracking',
					'version'   => VI_WOOCOMMERCE_ORDERS_TRACKING_VERSION,
				)
			);
		}
	}
}