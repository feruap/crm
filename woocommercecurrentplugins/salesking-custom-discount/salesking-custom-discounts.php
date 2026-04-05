<?php
/**
 * Plugin Name: SalesKing Custom Discount Authorization
 * Description: Allows child agents to request additional discounts from parent agents or super admins, with automatic coupon generation and application.
 * Version: 2.0.0
 * Author: Custom
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

define( 'SK_CD_DIR', plugin_dir_path( __FILE__ ) );
define( 'SK_CD_URL', plugin_dir_url( __FILE__ ) );

class SK_Custom_Discounts {

    private static $instance = null;

    public static function instance() {
        if ( is_null( self::$instance ) ) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        add_action( 'init', array( $this, 'register_cpt' ) );
        add_action( 'plugins_loaded', array( $this, 'load_includes' ) );
    }

    public function load_includes() {
        // Only load if WooCommerce and SalesKing are active
        if ( ! class_exists( 'WooCommerce' ) ) {
            return;
        }
        require_once SK_CD_DIR . 'includes/class-routing.php';
        require_once SK_CD_DIR . 'includes/class-frontend-cart.php';
        require_once SK_CD_DIR . 'includes/class-dashboard.php';
    }

    public function register_cpt() {
        register_post_type( 'sk_discount_req', array(
            'label'               => 'Discount Requests',
            'public'              => false,
            'show_ui'             => true,
            'show_in_menu'        => true,
            'menu_position'       => 56,
            'menu_icon'           => 'dashicons-tickets-alt',
            'supports'            => array( 'title' ),
            'exclude_from_search' => true,
            'publicly_queryable'  => false,
            'capability_type'     => 'post',
        ) );
    }

    public static function parse_switch_cookie() {
        if ( ! isset( $_COOKIE['salesking_switch_cookie'] ) || empty( $_COOKIE['salesking_switch_cookie'] ) ) {
            return false;
        }
        $cookie_val = sanitize_text_field( $_COOKIE['salesking_switch_cookie'] );
        if ( empty( $cookie_val ) ) {
            return false;
        }
        $parts = explode( '_', $cookie_val );
        if ( count( $parts ) < 3 ) {
            return false;
        }
        $customer_id = intval( $parts[0] );
        $agent_id    = intval( $parts[1] );
        if ( $customer_id <= 0 || $agent_id <= 0 ) {
            return false;
        }
        return array(
            'customer_id' => $customer_id,
            'agent_id'    => $agent_id,
        );
    }
}

// 1. Evitar el parpadeo de pantalla en el panel cargando órdenes vía AJAX
add_filter('salesking_load_orders_table_ajax', '__return_true');

// 2. Agregar visualmente las columnas de "Payment Link" y "Tracking Info" (Sustituye código del Snippet 16 y 46)
add_action('salesking_my_orders_custom_columns', function(){
    ?>
    <th class="nk-tb-col tb-col-sm"><span class="sub-text"><?php esc_html_e('Payment Link','salesking'); ?></span></th>
    <th class="nk-tb-col tb-col-sm"><span class="sub-text"><?php esc_html_e('Tracking Info','salesking'); ?></span></th>
    <?php
});

add_action('salesking_my_orders_custom_columns_footer', function(){
     ?>
     <th class="nk-tb-col tb-col-sm"><span class="sub-text"><?php esc_html_e('link','salesking'); ?></span></th>
     <th class="nk-tb-col tb-col-sm"><span class="sub-text"><?php esc_html_e('tracking_info','salesking'); ?></span></th>
     <?php
});

// 3. Prevenir el error de DataTables al insertar la información de pago y rastreo directo en el JSON del AJAX
add_filter('salesking_orders_table_ajax_data', function($data) {
    if (isset($data['data']) && is_array($data['data'])) {
        foreach ($data['data'] as &$row) {
            $order_id = 0;
            // Extraer el ID del pedido del botón "Manage Order" que provee SalesKing
            if (isset($row[6]) && preg_match('/value="(\d+)"/', $row[6], $matches)) {
                $order_id = intval($matches[1]);
            }
            
            $payment_html = '<td class="nk-tb-col tb-col-sm"></td>';
            $tracking_html = '<td class="nk-tb-col tb-col-sm"></td>';
            
            if ($order_id > 0) {
                $order = wc_get_order($order_id);
                if ($order) {
                    // Generar Link de Pago (Lógica del Snippet 16)
                    ob_start();
                    ?>
                    <td class="nk-tb-col tb-col-sm">
                        <div>
                            <span class="tb-sub">
                                <?php if ($order->get_status() == 'pending'){
                                    echo '<a href="'.$order->get_checkout_payment_url().'">Payment URL</a>'; 
                                }?>
                            </span>
                        </div>
                    </td>
                    <?php
                    $payment_html = ob_get_clean();

                    // Generar Link de Rastreo Skydropx (Lógica del Snippet 46)
                    $tracking_number = get_post_meta($order->get_id(), '_wot_tracking_number', true);
                    $tracking_carrier = get_post_meta($order->get_id(), '_wot_tracking_carrier', true);
                    $tracking_url = 'https://rastreo.skydropx.com/?tracking_number=' . urlencode($tracking_number);
                    
                    ob_start();
                    ?>
                    <td class="nk-tb-col tb-col-sm">
                        <div>
                             <span class="tb-sub">
                                <?php 
                                    if ($tracking_number) {
                                        echo '<a href="' . esc_url($tracking_url) . '" target="_blank">';
                                        echo esc_html($tracking_number . ' (' . $tracking_carrier . ')');
                                        echo '</a>';
                                    } else {
                                        echo esc_html__('No tracking info', 'salesking');
                                    }
                                ?>
                             </span>
                         </div>
                     </td>
                    <?php
                    $tracking_html = ob_get_clean();
                }
            }

            // Reconstruir la fila: insertamos Payment y Tracking después del Cliente (índice 3)
            $row = array(
                $row[0], // Order
                $row[1], // Date
                $row[2], // Status
                $row[3], // Customer
                $payment_html,
                $tracking_html,
                $row[4], // Purchased
                $row[5], // Order Total
                $row[6]  // Actions
            );
        }
    }
    return $data;
});

SK_Custom_Discounts::instance();
