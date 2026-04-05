<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }

class SK_CD_Frontend_Cart {

    public function __construct() {
        add_action( 'woocommerce_after_cart_table', array( $this, 'render_discount_request_ui' ) );
        add_action( 'woocommerce_after_cart_table', array( $this, 'cart_page_js' ) );
        add_action( 'wp_ajax_sk_submit_discount_request', array( $this, 'ajax_submit_request' ) );
        add_action( 'woocommerce_before_calculate_totals', array( $this, 'auto_apply_approved_coupon' ), 10 );

        // Detect SalesKing price modifications AFTER SalesKing applies them (priority 99)
        add_action( 'woocommerce_before_calculate_totals', array( __CLASS__, 'detect_price_modifications' ), 99 );

        // RULE 1: If coupons exist, block price changes
        add_action( 'woocommerce_cart_updated', array( $this, 'block_price_change_if_coupons' ), 5 );

        // RULE 2: If prices modified, block coupon application
        add_filter( 'woocommerce_coupon_is_valid', array( $this, 'block_coupon_if_prices_modified' ), 10, 2 );
    }

    /* === HELPERS === */

    private static function has_pending_request( $agent_id, $customer_id ) {
        $p = get_posts( array(
            'post_type' => 'sk_discount_req', 'posts_per_page' => 1, 'post_status' => 'publish', 'fields' => 'ids',
            'meta_query' => array( 'relation' => 'AND',
                array( 'key' => 'sk_req_agent_id',    'value' => $agent_id ),
                array( 'key' => 'sk_req_customer_id', 'value' => $customer_id ),
                array( 'key' => 'sk_req_status',      'value' => 'pending' ),
            ),
        ) );
        return ! empty( $p );
    }

    private static function cart_has_coupons() {
        if ( ! function_exists('WC') || ! WC()->cart ) return false;
        $coupons = WC()->cart->get_applied_coupons();
        return ! empty( $coupons );
    }

    /**
     * Runs AFTER SalesKing (priority 99) during woocommerce_before_calculate_totals.
     * Compares each product's DB price vs cart item price to detect SalesKing modifications.
     * Stores result in WC session so it persists for AJAX checks.
     */
    public static function detect_price_modifications( $cart ) {
        if ( is_admin() && ! defined('DOING_AJAX') ) return;
        if ( did_action('woocommerce_before_calculate_totals') >= 2 ) return; // prevent recursion
        $modified = false;
        foreach ( $cart->get_cart() as $cart_item ) {
            $pid = ! empty( $cart_item['variation_id'] ) ? $cart_item['variation_id'] : $cart_item['product_id'];
            $db_price = floatval( get_post_meta( $pid, '_price', true ) );
            $cart_price = floatval( $cart_item['data']->get_price() );
            if ( $db_price > 0 && abs( $db_price - $cart_price ) > 0.01 ) {
                $modified = true;
                break;
            }
        }
        if ( function_exists('WC') && WC()->session ) {
            WC()->session->set( 'sk_cd_prices_modified', $modified ? 'yes' : 'no' );
        }
    }

    private static function cart_has_modified_prices() {
        // First check session flag set by detect_price_modifications hook
        if ( function_exists('WC') && WC()->session ) {
            $flag = WC()->session->get( 'sk_cd_prices_modified', 'no' );
            if ( $flag === 'yes' ) return true;
        }
        // Fallback: direct comparison (works when totals already calculated)
        if ( ! function_exists('WC') || ! WC()->cart ) return false;
        foreach ( WC()->cart->get_cart() as $cart_item ) {
            $pid = ! empty( $cart_item['variation_id'] ) ? $cart_item['variation_id'] : $cart_item['product_id'];
            $db_price = floatval( get_post_meta( $pid, '_price', true ) );
            $cart_price = floatval( $cart_item['data']->get_price() );
            if ( $db_price > 0 && abs( $db_price - $cart_price ) > 0.01 ) return true;
        }
        return false;
    }

    private static function should_lock_prices( $agent_id, $customer_id ) {
        // Prices locked if: any coupon is applied OR pending discount request
        return self::cart_has_coupons()
            || self::has_pending_request( $agent_id, $customer_id );
    }

    /* === RULE 1: Coupons → block price changes (server-side) === */

    public function block_price_change_if_coupons() {
        $ctx = SK_Custom_Discounts::parse_switch_cookie();
        if ( ! $ctx ) return;
        if ( ! self::should_lock_prices( $ctx['agent_id'], $ctx['customer_id'] ) ) return;
        if ( ! function_exists('WC') || ! WC()->cart ) return;
        $blocked = false;
        foreach ( WC()->cart->get_cart() as $cart_key => $cart_item ) {
            if ( isset( $_POST['cart'][ $cart_key ]['_salesking_set_price'] ) ) {
                unset( $_POST['cart'][ $cart_key ]['_salesking_set_price'] );
                $blocked = true;
            }
        }
        if ( $blocked ) {
            wc_add_notice( 'No puedes cambiar precios mientras haya cupones aplicados o una solicitud pendiente.', 'error' );
        }
    }

    /* === RULE 2: Modified prices → block coupons === */

    public function block_coupon_if_prices_modified( $valid, $coupon ) {
        $ctx = SK_Custom_Discounts::parse_switch_cookie();
        if ( ! $ctx ) return $valid; // Not in "shop as customer", skip
        if ( self::cart_has_modified_prices() ) {
            throw new Exception( 'No puedes aplicar cupones si has modificado precios. Restaura los precios originales primero.' );
        }
        return $valid;
    }

    /* === UI === */

    public function render_discount_request_ui() {
        $ctx = SK_Custom_Discounts::parse_switch_cookie();
        if ( ! $ctx ) return;
        $agent_id    = $ctx['agent_id'];
        $customer_id = $ctx['customer_id'];
        $agent_max   = SK_CD_Routing::get_agent_max_discount( $agent_id );
        $nonce       = wp_create_nonce( 'sk_discount_req' );
        $has_pending = self::has_pending_request( $agent_id, $customer_id );
        $has_coupons = self::cart_has_coupons();
        $prices_mod  = self::cart_has_modified_prices();
        $is_locked   = $has_coupons || $has_pending;
        ?>
        <div id="sk_discount_request_box" style="margin-top:20px;padding:15px;border:1px solid #e5e5e5;background:#fafafa;border-radius:4px;">
            <h4 style="margin-top:0;">Solicitar Autorizacion de Descuento Adicional</h4>
            <?php if ( $has_coupons && ! $has_pending ) : ?>
                <div style="background:#d4edda;border:1px solid #c3e6cb;border-radius:4px;padding:12px;margin-bottom:10px;color:#155724;">
                    <strong>&#10004; Cupon activo en el carrito</strong><br>
                    Hay un cupon aplicado. <strong>Los precios estan bloqueados</strong> mientras haya cupones activos.
                </div>
            <?php elseif ( $prices_mod ) : ?>
                <div style="background:#f8d7da;border:1px solid #f5c6cb;border-radius:4px;padding:12px;margin-bottom:10px;color:#721c24;">
                    <strong>&#9888; Precios modificados</strong><br>
                    Has cambiado precios. Para solicitar un descuento adicional,
                    <strong>restaura los precios originales</strong> primero.
                    <br><em>Tampoco puedes aplicar cupones mientras los precios esten modificados.</em>
                </div>
            <?php elseif ( $has_pending ) : ?>
                <div style="background:#fff3cd;border:1px solid #ffc107;border-radius:4px;padding:12px;margin-bottom:10px;">
                    <strong>&#9888; Solicitud pendiente</strong><br>
                    Ya tienes una solicitud de descuento pendiente.
                    <strong>Los precios estan bloqueados</strong> hasta que se resuelva.
                </div>
            <?php else : ?>
                <p style="font-size:13px;color:#666;">
                    Tu limite actual es <strong><?php echo esc_html( $agent_max ); ?>%</strong>.
                    Si necesitas un descuento mayor, solicita autorizacion.
                </p>
                <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:10px;">
                    <input type="number" id="sk_req_discount_pct" step="0.5" min="0.5" max="100"
                           placeholder="% deseado" style="width:130px;padding:6px;" />
                </div>
                <div style="margin-bottom:10px;">
                    <label for="sk_req_reason" style="font-size:13px;font-weight:600;">Razon / Justificacion:</label>
                    <textarea id="sk_req_reason" rows="3" style="width:100%;margin-top:4px;padding:6px;"
                              placeholder="Explica por que necesitas este descuento adicional..."></textarea>
                </div>
                <button type="button" id="sk_submit_discount_btn" class="button alt"
                        data-agent="<?php echo esc_attr( $agent_id ); ?>"
                        data-customer="<?php echo esc_attr( $customer_id ); ?>"
                        data-nonce="<?php echo esc_attr( $nonce ); ?>">
                    Solicitar Autorizacion
                </button>
                <div id="sk_discount_msg" style="margin-top:8px;"></div>
            <?php endif; ?>
        </div>
        <?php
    }

    /* === JS === */

    public function cart_page_js() {
        if ( ! function_exists( 'is_cart' ) || ! is_cart() ) return;
        $ctx = SK_Custom_Discounts::parse_switch_cookie();
        $is_locked = false;
        if ( $ctx ) {
            $is_locked = self::should_lock_prices( $ctx['agent_id'], $ctx['customer_id'] );
        }
        ?>
        <script>
        jQuery(function($){
            <?php if ( $is_locked ) : ?>
            (function(){
                var $pi = $('input[name*="_salesking_set_price"]');
                $pi.each(function(){
                    $(this).prop('readonly', true)
                           .css({'background':'#f0f0f0','color':'#999','cursor':'not-allowed','border':'1px solid #dc3545'})
                           .attr('title','Precio bloqueado');
                    $(this).data('sk-locked', $(this).val());
                    $(this).on('change input', function(){ $(this).val($(this).data('sk-locked')); });
                });
                $('table.shop_table').before(
                    '<div style="background:#f8d7da;border:1px solid #f5c6cb;color:#721c24;padding:12px 15px;border-radius:4px;margin-bottom:15px;font-weight:600;">' +
                    '&#128274; Precios bloqueados. No puedes modificar precios mientras haya cupones o solicitudes pendientes.</div>'
                );
            })();
            <?php else : ?>
            $(document).on('click', '#sk_submit_discount_btn', function(e){
                e.preventDefault();
                var pct = parseFloat($('#sk_req_discount_pct').val());
                var reason = $.trim($('#sk_req_reason').val());
                var agent = $(this).data('agent'), customer = $(this).data('customer'), nonce = $(this).data('nonce');
                var $btn = $(this), $msg = $('#sk_discount_msg');
                if(!pct||pct<=0){ $msg.html('<span style="color:red;">Ingresa un porcentaje valido.</span>'); return; }
                if(!reason){ $msg.html('<span style="color:red;">Escribe una razon.</span>'); return; }
                $btn.prop('disabled',true).text('Enviando...');
                $.post('<?php echo esc_url(admin_url("admin-ajax.php")); ?>',{
                    action:'sk_submit_discount_request', nonce:nonce, pct:pct, reason:reason, agent:agent, customer:customer
                },function(res){
                    if(res.success){
                        $msg.html('<span style="color:green;">'+res.data+'</span>');
                        $('#sk_req_discount_pct').val(''); $('#sk_req_reason').val('');
                        setTimeout(function(){ location.reload(); },2000);
                    } else {
                        $msg.html('<span style="color:red;">'+res.data+'</span>');
                    }
                    $btn.prop('disabled',false).text('Solicitar Autorizacion');
                }).fail(function(){
                    $msg.html('<span style="color:red;">Error de conexion.</span>');
                    $btn.prop('disabled',false).text('Solicitar Autorizacion');
                });
            });
            <?php endif; ?>
        });
        </script>
        <?php
    }

    /* === AJAX === */

    public function ajax_submit_request() {
        check_ajax_referer( 'sk_discount_req', 'nonce' );
        $pct         = floatval( $_POST['pct'] );
        $agent_id    = intval( $_POST['agent'] );
        $customer_id = intval( $_POST['customer'] );
        $reason      = isset($_POST['reason']) ? sanitize_textarea_field( $_POST['reason'] ) : '';

        if ( $pct <= 0 || $pct > 100 ) { wp_send_json_error('Porcentaje invalido.'); wp_die(); }
        if ( ! get_userdata( $agent_id ) ) { wp_send_json_error('Agente no valido.'); wp_die(); }

        $own_limit = SK_CD_Routing::get_agent_max_discount( $agent_id );
        if ( $pct <= $own_limit ) {
            wp_send_json_error('El '.$pct.'% esta dentro de tu limite ('.$own_limit.'%). No necesitas autorizacion.');
            wp_die();
        }

        // RULE 3: block if pending exists
        if ( self::has_pending_request( $agent_id, $customer_id ) ) {
            wp_send_json_error('Ya tienes una solicitud pendiente para este cliente.');
            wp_die();
        }

        // Block if prices modified (force totals calc to trigger detection hook)
        if ( function_exists('WC') && WC()->cart ) { WC()->cart->calculate_totals(); }
        if ( self::cart_has_modified_prices() ) {
            wp_send_json_error('No puedes solicitar descuento con precios modificados. Restaura los originales.');
            wp_die();
        }

        // Block if coupons applied
        if ( self::cart_has_coupons() ) {
            wp_send_json_error('No puedes solicitar descuento con cupones aplicados. Remueve los cupones primero.');
            wp_die();
        }

        // Capture cart snapshot
        $cart_items = array(); $cart_subtotal = 0;
        if ( function_exists('WC') && WC()->cart ) {
            foreach ( WC()->cart->get_cart() as $item ) {
                $product = $item['data'];
                $regular = floatval( $product->get_regular_price() );
                $current = floatval( $product->get_price() );
                $cart_items[] = array(
                    'name' => $product->get_name(), 'qty' => $item['quantity'],
                    'regular_price' => $regular, 'price' => $current,
                    'modified' => ( abs($regular - $current) > 0.01 ), 'total' => $item['line_total'],
                );
                $cart_subtotal += $item['line_total'];
            }
        }
        $savings = round( $cart_subtotal * ( $pct / 100 ), 2 );
        $approver = SK_CD_Routing::get_approver_for_discount( $agent_id, $pct );

        $post_id = wp_insert_post( array(
            'post_title' => sprintf('Desc. %s%% - Cliente #%d - Agente #%d', $pct, $customer_id, $agent_id),
            'post_type' => 'sk_discount_req', 'post_status' => 'publish',
        ) );
        if ( is_wp_error($post_id) || !$post_id ) { wp_send_json_error('No se pudo crear.'); wp_die(); }

        update_post_meta( $post_id, 'sk_req_amount',        $pct );
        update_post_meta( $post_id, 'sk_req_agent_id',      $agent_id );
        update_post_meta( $post_id, 'sk_req_customer_id',   $customer_id );
        update_post_meta( $post_id, 'sk_req_approver_id',   $approver );
        update_post_meta( $post_id, 'sk_req_status',        'pending' );
        update_post_meta( $post_id, 'sk_req_reason',        $reason );
        update_post_meta( $post_id, 'sk_req_cart_items',    $cart_items );
        update_post_meta( $post_id, 'sk_req_cart_subtotal', $cart_subtotal );
        update_post_meta( $post_id, 'sk_req_savings',       $savings );

        if ( $approver === 'admin' ) { $dest = 'Administrador'; }
        else { $u = get_userdata($approver); $dest = $u ? $u->display_name : 'Agente #'.$approver; }

        wp_send_json_success('Solicitud enviada a: '.$dest.'. Precios bloqueados.');
        wp_die();
    }

    /* === AUTO-APPLY === */

    public function auto_apply_approved_coupon() {
        if ( is_admin() && ! defined('DOING_AJAX') ) return;
        $ctx = SK_Custom_Discounts::parse_switch_cookie();
        if ( ! $ctx ) return;
        if ( ! function_exists('WC') || ! WC()->cart ) return;
        $approved = get_posts( array(
            'post_type' => 'sk_discount_req', 'post_status' => 'publish', 'posts_per_page' => -1,
            'meta_query' => array( 'relation' => 'AND',
                array( 'key' => 'sk_req_agent_id',    'value' => $ctx['agent_id'] ),
                array( 'key' => 'sk_req_customer_id', 'value' => $ctx['customer_id'] ),
                array( 'key' => 'sk_req_status',      'value' => 'approved' ),
            ),
        ) );
        foreach ( $approved as $req ) {
            $code = get_post_meta( $req->ID, 'sk_req_coupon', true );
            if ( $code && ! WC()->cart->has_discount( $code ) ) {
                WC()->cart->apply_coupon( $code );
                wc_add_notice( sprintf('Cupon autorizado (%s%%) aplicado: %s', get_post_meta($req->ID,'sk_req_amount',true), $code), 'success' );
            }
        }
    }
}
new SK_CD_Frontend_Cart();