<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }

class SK_CD_Dashboard {

    public function __construct() {
        add_action( 'admin_menu', array( $this, 'add_admin_menus' ) );
        add_action( 'admin_menu', array( $this, 'relocate_cpt_menu' ), 99 );
        add_filter( 'salesking_dashboard_menu_items', array( $this, 'add_dashboard_menu_item' ) );
        add_shortcode( 'sk_discount_approvals', array( $this, 'shortcode_output' ) );
        add_shortcode( 'sk_my_discount_requests', array( $this, 'shortcode_my_requests' ) );
        add_action( 'wp_ajax_sk_approve_discount', array( $this, 'ajax_approve' ) );
        add_action( 'wp_ajax_sk_reject_discount',  array( $this, 'ajax_reject' ) );
        add_action( 'wp_ajax_sk_cancel_discount',  array( $this, 'ajax_cancel' ) );

        // SalesKing frontend dashboard page rendering
        add_action( 'salesking_extend_page', array( $this, 'extend_page' ) );

        // CPT Historial custom columns
        add_filter( 'manage_sk_discount_req_posts_columns', array( $this, 'historial_columns' ) );
        add_action( 'manage_sk_discount_req_posts_custom_column', array( $this, 'historial_column_data' ), 10, 2 );
        add_action( 'admin_footer-edit.php', array( $this, 'historial_detail_js' ) );
    }

    /* === SalesKing Frontend Page Rendering === */

    public function extend_page( $page ) {
        if ( $page === 'discount-approvals' ) {
            echo '<div class="nk-content"><div class="container-xl"><div class="nk-content-inner"><div class="nk-content-body">';
            echo do_shortcode('[sk_discount_approvals]');
            echo '</div></div></div></div>';
        } elseif ( $page === 'my-discount-requests' ) {
            echo '<div class="nk-content"><div class="container-xl"><div class="nk-content-inner"><div class="nk-content-body">';
            echo do_shortcode('[sk_my_discount_requests]');
            echo '</div></div></div></div>';
        }
    }

    /* === MENUS === */

    public function add_admin_menus() {
        add_menu_page( 'Autorizar Descuentos', 'Autorizar Descuentos', 'manage_woocommerce', 'sk-discount-approvals', array( $this, 'render_admin_page' ), 'dashicons-tickets-alt', 56 );
        add_submenu_page( 'sk-discount-approvals', 'Pendientes', 'Pendientes', 'manage_woocommerce', 'sk-discount-approvals', array( $this, 'render_admin_page' ) );
        add_submenu_page( 'sk-discount-approvals', 'Historial', 'Historial', 'manage_woocommerce', 'edit.php?post_type=sk_discount_req' );
        add_submenu_page( 'sk-discount-approvals', 'Reportes', 'Reportes', 'manage_woocommerce', 'sk-discount-reports', array( $this, 'render_reports_page' ) );
    }

    public function relocate_cpt_menu() { remove_menu_page( 'edit.php?post_type=sk_discount_req' ); }

    /* === ADMIN PAGE === */

    public function render_admin_page() {
        $uid = get_current_user_id();
        $is_agent = get_user_meta( $uid, 'salesking_group', true );
        echo '<div class="wrap">';
        if ( current_user_can( 'administrator' ) && empty( $is_agent ) ) {
            echo '<h1>Todas las Solicitudes Pendientes</h1>';
            $this->render_hierarchy_table( 'admin', 0, false );
        } else {
            $max = SK_CD_Routing::get_agent_max_discount( $uid );
            echo '<h1>Solicitudes de tu Equipo</h1>';
            echo '<p style="color:#666;">Tu limite: <strong>' . esc_html( $max ) . '%</strong></p>';
            $this->render_hierarchy_table( $uid, $uid, false );
            // Admin-assigned requests: view-only
            echo '<h2 style="margin-top:30px;">Solicitudes Pendientes con Admin</h2>';
            echo '<p style="color:#999;font-size:12px;">Estas solicitudes exceden tu limite y estan asignadas al administrador. Solo puedes verlas.</p>';
            $this->render_hierarchy_table( 'admin', 0, true );
        }
        $this->render_table_js();
        echo '</div>';
    }

    public function add_dashboard_menu_item( $menu ) {
        $menu['my-discount-requests'] = array( 'sk_cd_always_enabled', 'my-discount-requests', 'ni-archive-fill', 'Mis Solicitudes' );
        add_filter( 'sk_cd_always_enabled', function() { return 1; } );
        return $menu;
    }

    public function shortcode_output( $atts = array() ) {
        if ( ! is_user_logged_in() ) return '<p>No has iniciado sesion.</p>';
        $uid = get_current_user_id();
        ob_start();
        echo '<div style="padding:20px 0;">';
        echo '<h3>Solicitudes de Descuento de tu Equipo</h3>';
        $this->render_hierarchy_table( $uid, $uid, false );
        echo '<h3 style="margin-top:30px;">Solicitudes Pendientes con Admin</h3>';
        $this->render_hierarchy_table( 'admin', 0, true );
        $this->render_table_js();
        echo '</div>';
        return ob_get_clean();
    }

    /* === AGENT: MY REQUESTS === */

    public function shortcode_my_requests( $atts = array() ) {
        if ( ! is_user_logged_in() ) return '<p>No has iniciado sesion.</p>';
        $uid = get_current_user_id();
        $cancel_nonce = wp_create_nonce( 'sk_cancel_discount' );
        $requests = get_posts( array(
            'post_type' => 'sk_discount_req', 'post_status' => 'publish', 'posts_per_page' => -1,
            'orderby' => 'date', 'order' => 'DESC',
            'meta_query' => array( array( 'key' => 'sk_req_agent_id', 'value' => $uid ) ),
        ) );
        ob_start();
        $ajax_url = admin_url('admin-ajax.php');
        echo '<div style="padding:20px 0;">';
        echo '<h3>Mis Solicitudes de Descuento</h3>';

        // Filter: hide completed (approved/rejected/cancelled) older than 10 days
        $ten_days_ago = strtotime('-10 days');
        $filtered = array();
        foreach ( $requests as $req ) {
            $st = get_post_meta($req->ID, 'sk_req_status', true);
            if ( in_array($st, array('approved','rejected','cancelled')) && strtotime($req->post_date) < $ten_days_ago ) continue;
            $filtered[] = $req;
        }

        if ( empty( $filtered ) ) {
            echo '<p style="color:#888;">No tienes solicitudes recientes.</p>';
        } else {
            $status_labels = array('pending'=>'Pendiente','approved'=>'Aprobada','rejected'=>'Rechazada','cancelled'=>'Cancelada');
            $status_colors = array('pending'=>'#ffc107','approved'=>'#28a745','rejected'=>'#dc3545','cancelled'=>'#6c757d');
            $status_icons  = array('pending'=>'&#9203;','approved'=>'&#10004;','rejected'=>'&#10008;','cancelled'=>'&#10060;');

            foreach ( $filtered as $req ) {
                $st     = get_post_meta($req->ID, 'sk_req_status', true);
                $amt    = get_post_meta($req->ID, 'sk_req_amount', true);
                $cid    = get_post_meta($req->ID, 'sk_req_customer_id', true);
                $coupon = get_post_meta($req->ID, 'sk_req_coupon', true);
                $subtotal   = floatval(get_post_meta($req->ID, 'sk_req_cart_subtotal', true));
                $savings    = floatval(get_post_meta($req->ID, 'sk_req_savings', true));
                $cart_items = get_post_meta($req->ID, 'sk_req_cart_items', true);
                $cu = get_userdata($cid);
                $cname = $cu ? $cu->display_name : '#'.$cid;
                $sl = isset($status_labels[$st]) ? $status_labels[$st] : $st;
                $sc = isset($status_colors[$st]) ? $status_colors[$st] : '#888';
                $si = isset($status_icons[$st]) ? $status_icons[$st] : '';
                $date = esc_html(get_the_date('d/m/Y H:i', $req->ID));
                $detail_id = 'sk-myreq-' . $req->ID;

                // Build product summary (short)
                $prod_summary = '';
                if ( !empty($cart_items) && is_array($cart_items) ) {
                    $names = array();
                    foreach ($cart_items as $ci) { $names[] = $ci['name'] . ' x' . intval($ci['qty']); }
                    $prod_summary = implode(', ', $names);
                    if (strlen($prod_summary) > 80) $prod_summary = substr($prod_summary, 0, 77) . '...';
                }
                ?>
                <div style="border:1px solid #e5e5e5;border-radius:6px;margin-bottom:12px;background:#fff;overflow:hidden;">
                    <!-- Header row -->
                    <div style="display:flex;align-items:center;gap:12px;padding:12px 15px;flex-wrap:wrap;background:#fafafa;border-bottom:1px solid #eee;">
                        <div style="flex:1;min-width:150px;">
                            <div style="font-weight:600;font-size:14px;"><?php echo esc_html($cname); ?></div>
                            <div style="font-size:11px;color:#888;"><?php echo $date; ?></div>
                        </div>
                        <div style="text-align:center;min-width:60px;">
                            <div style="font-weight:700;font-size:16px;color:#333;"><?php echo esc_html($amt); ?>%</div>
                            <div style="font-size:10px;color:#888;">Descuento</div>
                        </div>
                        <div style="text-align:center;min-width:80px;">
                            <div style="font-weight:600;font-size:14px;">$<?php echo number_format($subtotal, 2); ?></div>
                            <div style="font-size:10px;color:#888;">Subtotal</div>
                        </div>
                        <div style="text-align:center;min-width:70px;">
                            <div style="font-weight:600;font-size:14px;color:#c00;">-$<?php echo number_format($savings, 2); ?></div>
                            <div style="font-size:10px;color:#888;">Ahorro</div>
                        </div>
                        <div style="min-width:90px;text-align:center;">
                            <span style="background:<?php echo $sc; ?>;color:#fff;padding:4px 10px;border-radius:12px;font-size:12px;"><?php echo $si . ' ' . esc_html($sl); ?></span>
                        </div>
                        <div style="min-width:160px;text-align:right;">
                            <?php if ( $st === 'approved' && $coupon ) : ?>
                                <code style="background:#d4edda;padding:4px 8px;border-radius:3px;font-size:12px;"><?php echo esc_html($coupon); ?></code>
                                <?php
                                    $cart_url = wc_get_cart_url();
                                    $go_url = add_query_arg( 'salesking_switch_customer', $cid, $cart_url );
                                ?>
                                <a href="<?php echo esc_url($go_url); ?>" style="display:inline-block;background:#28a745;color:#fff;border:none;padding:5px 10px;border-radius:4px;cursor:pointer;font-size:11px;text-decoration:none;margin-left:4px;" title="Ir al carrito del cliente para completar el pedido">Ir al Pedido</a>
                            <?php endif; ?>
                            <?php if ( $st === 'pending' ) : ?>
                                <button type="button" class="sk-cancel-req" data-id="<?php echo esc_attr($req->ID); ?>" data-nonce="<?php echo esc_attr($cancel_nonce); ?>" style="background:#dc3545;color:#fff;border:none;padding:5px 10px;border-radius:4px;cursor:pointer;font-size:11px;">Cancelar</button>
                            <?php endif; ?>
                            <button type="button" class="sk-myreq-toggle" data-target="<?php echo esc_attr($detail_id); ?>" style="background:#17a2b8;color:#fff;border:none;padding:5px 10px;border-radius:4px;cursor:pointer;font-size:11px;">Detalle</button>
                        </div>
                    </div>
                    <!-- Products summary (always visible) -->
                    <?php if ($prod_summary) : ?>
                    <div style="padding:6px 15px;font-size:12px;color:#666;background:#f9f9f9;">
                        <strong>Productos:</strong> <?php echo esc_html($prod_summary); ?>
                    </div>
                    <?php endif; ?>
                    <!-- Expandable detail -->
                    <div id="<?php echo esc_attr($detail_id); ?>" style="display:none;padding:12px 15px;border-top:1px solid #eee;">
                        <?php if ( !empty($cart_items) && is_array($cart_items) ) : ?>
                        <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:8px;">
                            <thead><tr style="background:#e9ecef;">
                                <th style="padding:6px;text-align:left;">Producto</th>
                                <th style="padding:6px;text-align:center;">Cant.</th>
                                <th style="padding:6px;text-align:right;">Precio</th>
                                <th style="padding:6px;text-align:right;">Total</th>
                            </tr></thead><tbody>
                            <?php foreach ($cart_items as $ci) : ?>
                            <tr style="border-bottom:1px solid #eee;">
                                <td style="padding:5px 6px;"><?php echo esc_html($ci['name']); ?></td>
                                <td style="padding:5px;text-align:center;"><?php echo intval($ci['qty']); ?></td>
                                <td style="padding:5px;text-align:right;">$<?php echo number_format(floatval($ci['price']),2); ?></td>
                                <td style="padding:5px;text-align:right;">$<?php echo number_format(floatval($ci['total']),2); ?></td>
                            </tr>
                            <?php endforeach; ?>
                            </tbody>
                        </table>
                        <?php else : ?>
                            <p style="color:#888;font-size:12px;margin:0;">Detalle de carrito no disponible.</p>
                        <?php endif; ?>
                        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
                            <div style="background:#f0f8ff;border:1px solid #bee5eb;border-radius:4px;padding:6px 12px;font-size:12px;">
                                <strong>Total Final:</strong> $<?php echo number_format($subtotal - $savings, 2); ?>
                            </div>
                        </div>
                    </div>
                </div>
                <?php
            }
        }
        echo '</div>';
        ?>
        <script>
        jQuery(function($){
            $(document).on('click','.sk-myreq-toggle',function(){
                var t=$(this).data('target');
                $('#'+t).slideToggle(200);
                $(this).text($('#'+t).is(':visible')?'Ocultar':'Detalle');
            });
            $(document).on('click','.sk-cancel-req',function(){
                if(!confirm('¿Cancelar esta solicitud de descuento?'))return;
                var $b=$(this);
                $b.prop('disabled',true).text('...');
                $.post('<?php echo esc_url($ajax_url); ?>',{action:'sk_cancel_discount',req_id:$b.data('id'),nonce:$b.data('nonce')},function(r){
                    if(r.success){ alert('Solicitud cancelada.'); location.reload(); }
                    else { alert('Error: '+r.data); $b.prop('disabled',false).text('Cancelar'); }
                }).fail(function(){ alert('Error de conexion'); $b.prop('disabled',false).text('Cancelar'); });
            });
        });
        </script>
        <?php
        return ob_get_clean();
    }

    /* === HIERARCHY TABLE (with $readonly flag) === */

    private function render_hierarchy_table( $viewer_id, $viewer_uid, $readonly = false ) {
        if ( $viewer_id === 'admin' || $viewer_id === 0 ) {
            $requests = get_posts( array(
                'post_type' => 'sk_discount_req', 'post_status' => 'publish',
                'posts_per_page' => -1,
                'meta_query' => array( array( 'key' => 'sk_req_status', 'value' => 'pending' ) ),
            ) );
        } else {
            $children = SK_CD_Routing::get_all_children( intval( $viewer_id ) );
            if ( empty( $children ) ) {
                echo '<p style="color:#888;">No tienes subagentes con solicitudes pendientes.</p>';
                return;
            }
            $requests = get_posts( array(
                'post_type' => 'sk_discount_req', 'post_status' => 'publish',
                'posts_per_page' => -1,
                'meta_query' => array( 'relation' => 'AND',
                    array( 'key' => 'sk_req_status', 'value' => 'pending' ),
                    array( 'key' => 'sk_req_agent_id', 'value' => $children, 'compare' => 'IN' ),
                ),
            ) );
        }

        // For non-readonly agent view: filter by their limit
        if ( ! $readonly && $viewer_uid > 0 ) {
            $viewer_max = SK_CD_Routing::get_agent_max_discount( $viewer_uid );
            $requests = array_filter( $requests, function( $req ) use ( $viewer_max ) {
                return floatval( get_post_meta( $req->ID, 'sk_req_amount', true ) ) <= $viewer_max;
            } );
        }

        if ( empty( $requests ) ) {
            echo '<p style="color:#888;">No hay solicitudes pendientes.</p>';
            return;
        }

        $nonce = wp_create_nonce( 'sk_discount_action' );
        $viewer_max = ( $viewer_uid > 0 ) ? SK_CD_Routing::get_agent_max_discount( $viewer_uid ) : 999;
        $this->render_shared_styles();
        ?>
        <table class="widefat striped" style="max-width:1100px;">
            <thead><tr>
                <th>ID</th><th>Subagente</th><th>Cliente</th><th>% Solic.</th>
                <th>Subtotal</th><th>Ahorro $</th><th>Fecha</th><th>Accion</th>
            </tr></thead>
            <tbody>
            <?php foreach ( $requests as $req ) :
                $this->render_request_row( $req, $nonce, $viewer_uid, $viewer_max, $readonly );
            endforeach; ?>
            </tbody>
        </table>
        <?php
    }

    /* === SHARED ROW RENDERER (used by both Pendientes and Historial) === */

    private function render_request_row( $req, $nonce, $viewer_uid, $viewer_max, $readonly ) {
        $aid = get_post_meta( $req->ID, 'sk_req_agent_id', true );
        $cid = get_post_meta( $req->ID, 'sk_req_customer_id', true );
        $amt = floatval( get_post_meta( $req->ID, 'sk_req_amount', true ) );
        $approver = get_post_meta( $req->ID, 'sk_req_approver_id', true );
        $status = get_post_meta( $req->ID, 'sk_req_status', true );
        $reason = get_post_meta( $req->ID, 'sk_req_reason', true );
        $cart_items = get_post_meta( $req->ID, 'sk_req_cart_items', true );
        $subtotal = floatval( get_post_meta( $req->ID, 'sk_req_cart_subtotal', true ) );
        $savings = floatval( get_post_meta( $req->ID, 'sk_req_savings', true ) );
        $coupon = get_post_meta( $req->ID, 'sk_req_coupon', true );

        $an = ($u = get_userdata($aid)) ? $u->display_name : '#'.$aid;
        $cn = ($u = get_userdata($cid)) ? $u->display_name : '#'.$cid;
        if ( $approver === 'admin' ) { $appr_name = 'Super Admin'; }
        else { $appr_name = ($u = get_userdata($approver)) ? $u->display_name : '#'.$approver; }

        $is_admin_view = ( current_user_can('administrator') && empty(get_user_meta(get_current_user_id(),'salesking_group',true)) );
        $can_approve = false;
        if ( ! $readonly && $status === 'pending' ) {
            $is_assigned = ( $viewer_uid > 0 && strval($approver) === strval($viewer_uid) );
            $can_approve = $is_admin_view || $is_assigned || ( $viewer_max >= $amt && $viewer_uid > 0 );
        }

        $detail_id = 'sk-detail-' . $req->ID;

        // Status badge
        $status_labels = array( 'pending' => 'Pendiente', 'approved' => 'Aprobada', 'rejected' => 'Rechazada' );
        $status_colors = array( 'pending' => '#ffc107', 'approved' => '#28a745', 'rejected' => '#dc3545' );
        $s_label = isset($status_labels[$status]) ? $status_labels[$status] : $status;
        $s_color = isset($status_colors[$status]) ? $status_colors[$status] : '#888';
        ?>
        <tr>
            <td>#<?php echo esc_html($req->ID); ?></td>
            <td><?php echo esc_html($an); ?></td>
            <td><?php echo esc_html($cn); ?></td>
            <td><strong><?php echo esc_html($amt); ?>%</strong></td>
            <td>$<?php echo esc_html( number_format( $subtotal, 2 ) ); ?></td>
            <td style="color:#c00;font-weight:600;">-$<?php echo esc_html( number_format( $savings, 2 ) ); ?></td>
            <td><?php echo esc_html(get_the_date('Y-m-d H:i', $req->ID)); ?></td>
            <td style="white-space:nowrap;">
                <button type="button" class="button sk-btn-detail sk-toggle-detail" data-target="<?php echo esc_attr($detail_id); ?>">Detalle</button>
                <?php if ( $can_approve ) : ?>
                    <button type="button" class="button sk-cd-approve sk-btn-can-approve" data-id="<?php echo esc_attr($req->ID); ?>" data-nonce="<?php echo esc_attr($nonce); ?>">Aprobar</button>
                    <button type="button" class="button sk-cd-reject sk-btn-reject" data-id="<?php echo esc_attr($req->ID); ?>" data-nonce="<?php echo esc_attr($nonce); ?>">Rechazar</button>
                <?php elseif ( $readonly && $status === 'pending' ) : ?>
                    <span style="background:<?php echo $s_color; ?>;color:#fff;padding:3px 8px;border-radius:3px;font-size:11px;"><?php echo esc_html($s_label); ?></span>
                <?php elseif ( $status !== 'pending' ) : ?>
                    <span style="background:<?php echo $s_color; ?>;color:#fff;padding:3px 8px;border-radius:3px;font-size:11px;"><?php echo esc_html($s_label); ?></span>
                    <?php if ( $coupon ) : ?><code style="font-size:11px;margin-left:5px;"><?php echo esc_html($coupon); ?></code><?php endif; ?>
                <?php endif; ?>
            </td>
        </tr>
        <tr class="sk-detail-row" id="<?php echo esc_attr($detail_id); ?>" style="display:none;">
            <td colspan="8">
                <?php if ( $reason ) : ?>
                    <div class="sk-reason"><strong>Razon:</strong> <?php echo esc_html( $reason ); ?></div>
                <?php endif; ?>
                <div class="sk-summary-box">
                    <div class="sk-summary-item"><strong>$<?php echo number_format($subtotal,2); ?></strong><small>Subtotal</small></div>
                    <div class="sk-summary-item"><strong><?php echo esc_html($amt); ?>%</strong><small>Descuento</small></div>
                    <div class="sk-summary-item"><strong style="color:#c00;">-$<?php echo number_format($savings,2); ?></strong><small>Ahorro</small></div>
                    <div class="sk-summary-item"><strong>$<?php echo number_format($subtotal - $savings,2); ?></strong><small>Total Final</small></div>
                </div>
                <?php if ( ! empty( $cart_items ) && is_array( $cart_items ) ) : ?>
                <table class="widefat" style="max-width:800px;">
                    <thead><tr><th>Producto</th><th>Cant.</th><th>Precio Original</th><th>Precio Actual</th><th>Total</th></tr></thead>
                    <tbody>
                    <?php foreach ( $cart_items as $ci ) :
                        $has_regular = isset($ci['regular_price']);
                        $modified = ! empty($ci['modified']);
                    ?>
                        <tr<?php echo $modified ? ' style="background:#fff0f0;"' : ''; ?>>
                            <td><?php echo esc_html( $ci['name'] ); ?><?php if($modified): ?> <span title="Precio modificado por el agente" style="color:#dc3545;font-weight:bold;">&#9888;</span><?php endif; ?></td>
                            <td><?php echo intval( $ci['qty'] ); ?></td>
                            <td><?php echo $has_regular ? '$' . number_format( floatval($ci['regular_price']), 2 ) : '—'; ?></td>
                            <td<?php echo $modified ? ' style="color:#dc3545;font-weight:bold;"' : ''; ?>>$<?php echo number_format( floatval($ci['price']), 2 ); ?></td>
                            <td>$<?php echo number_format( floatval($ci['total']), 2 ); ?></td>
                        </tr>
                    <?php endforeach; ?>
                    </tbody>
                </table>
                <?php else : ?>
                    <p style="color:#888;font-size:12px;">Detalle de carrito no disponible (solicitud anterior).</p>
                <?php endif; ?>
            </td>
        </tr>
        <?php
    }

    /* === SHARED STYLES === */

    private function render_shared_styles() {
        static $done = false;
        if ( $done ) return;
        $done = true;
        ?>
        <style>
        .sk-btn-can-approve { background:#28a745!important; border-color:#28a745!important; color:#fff!important; }
        .sk-btn-can-approve:hover { background:#218838!important; }
        .sk-btn-reject { background:#dc3545!important; border-color:#dc3545!important; color:#fff!important; }
        .sk-btn-reject:hover { background:#c82333!important; }
        .sk-btn-detail { background:#17a2b8!important; border-color:#17a2b8!important; color:#fff!important; font-size:12px; }
        .sk-btn-detail:hover { background:#138496!important; }
        .sk-detail-row td { background:#f0f8ff!important; padding:15px!important; }
        .sk-detail-row table { margin:0; background:#fff; }
        .sk-detail-row table th { background:#e9ecef; font-size:12px; }
        .sk-detail-row table td { font-size:12px; }
        .sk-reason { background:#fff8e1; padding:8px 12px; border-left:3px solid #ffc107; margin-bottom:10px; font-style:italic; }
        .sk-summary-box { display:flex; gap:20px; flex-wrap:wrap; margin-bottom:10px; }
        .sk-summary-item { background:#fff; border:1px solid #dee2e6; border-radius:4px; padding:8px 14px; text-align:center; }
        .sk-summary-item strong { display:block; font-size:16px; color:#333; }
        .sk-summary-item small { color:#888; font-size:11px; }
        </style>
        <?php
    }

    /* === HISTORIAL CPT COLUMNS === */

    public function historial_columns( $cols ) {
        $new = array();
        $new['cb'] = $cols['cb'];
        $new['title'] = $cols['title'];
        $new['sk_agent'] = 'Agente';
        $new['sk_customer'] = 'Cliente';
        $new['sk_pct'] = '% Desc.';
        $new['sk_subtotal'] = 'Subtotal';
        $new['sk_savings'] = 'Ahorro';
        $new['sk_status'] = 'Estado';
        $new['sk_detail'] = 'Detalle';
        $new['date'] = $cols['date'];
        return $new;
    }

    public function historial_column_data( $col, $post_id ) {
        switch ( $col ) {
            case 'sk_agent':
                $aid = get_post_meta( $post_id, 'sk_req_agent_id', true );
                $u = get_userdata( $aid );
                echo esc_html( $u ? $u->display_name : '#'.$aid );
                break;
            case 'sk_customer':
                $cid = get_post_meta( $post_id, 'sk_req_customer_id', true );
                $u = get_userdata( $cid );
                echo esc_html( $u ? $u->display_name : '#'.$cid );
                break;
            case 'sk_pct':
                echo '<strong>' . esc_html( get_post_meta( $post_id, 'sk_req_amount', true ) ) . '%</strong>';
                break;
            case 'sk_subtotal':
                $s = floatval(get_post_meta( $post_id, 'sk_req_cart_subtotal', true ));
                echo $s > 0 ? '$' . number_format($s, 2) : '—';
                break;
            case 'sk_savings':
                $s = floatval(get_post_meta( $post_id, 'sk_req_savings', true ));
                echo $s > 0 ? '<span style="color:#c00;">-$' . number_format($s, 2) . '</span>' : '—';
                break;
            case 'sk_status':
                $st = get_post_meta( $post_id, 'sk_req_status', true );
                $labels = array('pending'=>'Pendiente','approved'=>'Aprobada','rejected'=>'Rechazada');
                $colors = array('pending'=>'#ffc107','approved'=>'#28a745','rejected'=>'#dc3545');
                $l = isset($labels[$st]) ? $labels[$st] : $st;
                $c = isset($colors[$st]) ? $colors[$st] : '#888';
                echo '<span style="background:'.$c.';color:#fff;padding:3px 8px;border-radius:3px;font-size:11px;">' . esc_html($l) . '</span>';
                $coupon = get_post_meta( $post_id, 'sk_req_coupon', true );
                if ( $coupon ) echo '<br><code style="font-size:10px;">' . esc_html($coupon) . '</code>';
                break;
            case 'sk_detail':
                $reason = get_post_meta( $post_id, 'sk_req_reason', true );
                $cart_items = get_post_meta( $post_id, 'sk_req_cart_items', true );
                $subtotal = floatval(get_post_meta( $post_id, 'sk_req_cart_subtotal', true ));
                $savings = floatval(get_post_meta( $post_id, 'sk_req_savings', true ));
                $amt = floatval(get_post_meta( $post_id, 'sk_req_amount', true ));
                $did = 'sk-hist-detail-' . $post_id;
                echo '<button type="button" class="button sk-hist-toggle" data-target="' . esc_attr($did) . '" style="font-size:11px;">Ver</button>';
                echo '<div id="' . esc_attr($did) . '" style="display:none;margin-top:8px;max-width:500px;">';
                if ( $reason ) echo '<div style="background:#fff8e1;padding:6px 10px;border-left:3px solid #ffc107;margin-bottom:8px;font-style:italic;font-size:12px;"><strong>Razon:</strong> ' . esc_html($reason) . '</div>';
                echo '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:8px;">';
                echo '<div style="background:#f8f9fa;border:1px solid #dee2e6;border-radius:4px;padding:4px 10px;text-align:center;"><strong style="display:block;font-size:13px;">$' . number_format($subtotal,2) . '</strong><small style="font-size:10px;">Subtotal</small></div>';
                echo '<div style="background:#f8f9fa;border:1px solid #dee2e6;border-radius:4px;padding:4px 10px;text-align:center;"><strong style="display:block;font-size:13px;color:#c00;">-$' . number_format($savings,2) . '</strong><small style="font-size:10px;">Ahorro</small></div>';
                echo '<div style="background:#f8f9fa;border:1px solid #dee2e6;border-radius:4px;padding:4px 10px;text-align:center;"><strong style="display:block;font-size:13px;">$' . number_format($subtotal-$savings,2) . '</strong><small style="font-size:10px;">Final</small></div>';
                echo '</div>';
                if ( ! empty($cart_items) && is_array($cart_items) ) {
                    echo '<table style="width:100%;border-collapse:collapse;font-size:11px;"><thead><tr style="background:#e9ecef;"><th style="padding:4px 6px;text-align:left;">Producto</th><th style="padding:4px;">Cant.</th><th style="padding:4px;">Precio</th><th style="padding:4px;">Total</th></tr></thead><tbody>';
                    foreach ($cart_items as $ci) {
                        echo '<tr style="border-bottom:1px solid #eee;"><td style="padding:4px 6px;">' . esc_html($ci['name']) . '</td><td style="padding:4px;text-align:center;">' . intval($ci['qty']) . '</td><td style="padding:4px;">$' . number_format(floatval($ci['price']),2) . '</td><td style="padding:4px;">$' . number_format(floatval($ci['total']),2) . '</td></tr>';
                    }
                    echo '</tbody></table>';
                } else {
                    echo '<p style="color:#888;font-size:11px;margin:0;">Sin detalle de carrito.</p>';
                }
                echo '</div>';
                break;
        }
    }

    public function historial_detail_js() {
        global $typenow;
        if ( $typenow !== 'sk_discount_req' ) return;
        ?>
        <script>
        jQuery(function($){
            $(document).on('click','.sk-hist-toggle',function(){
                var t=$(this).data('target');
                $('#'+t).toggle();
                $(this).text($('#'+t).is(':visible')?'Ocultar':'Ver');
            });
        });
        </script>
        <?php
    }

    /* === JS FOR APPROVE/REJECT === */

    private function render_table_js() {
        static $rendered = false;
        if ( $rendered ) return;
        $rendered = true;
        $ajax_url = admin_url( 'admin-ajax.php' );
        ?>
        <script>
        jQuery(function($){
            $(document).on('click','.sk-toggle-detail',function(){
                var t=$(this).data('target');
                $('#'+t).toggle();
                $(this).text($('#'+t).is(':visible')?'Ocultar':'Detalle');
            });
            function skcdAction(a,id,n,$b){
                $b.prop('disabled',true).text('...');
                $.post('<?php echo esc_url($ajax_url); ?>',{action:a,req_id:id,nonce:n},function(r){
                    if(r.success){
                        var $row=$b.closest('tr');
                        $row.next('.sk-detail-row').fadeOut(300,function(){$(this).remove();});
                        $row.fadeOut(300,function(){$(this).remove();});
                        alert(a==='sk_approve_discount'?'Aprobado. Cupon: '+r.data:'Rechazada.');
                    } else { alert('Error: '+r.data); $b.prop('disabled',false); }
                }).fail(function(){ alert('Error de conexion'); $b.prop('disabled',false); });
            }
            $(document).on('click','.sk-cd-approve',function(){
                if(!confirm('Aprobar y generar cupon?'))return;
                skcdAction('sk_approve_discount',$(this).data('id'),$(this).data('nonce'),$(this));
            });
            $(document).on('click','.sk-cd-reject',function(){
                if(!confirm('Rechazar solicitud?'))return;
                skcdAction('sk_reject_discount',$(this).data('id'),$(this).data('nonce'),$(this));
            });
        });
        </script>
        <?php
    }

    /* === AJAX: APPROVE === */

    public function ajax_approve() {
        check_ajax_referer( 'sk_discount_action', 'nonce' );
        $req_id = intval( $_POST['req_id'] );
        if ( ! $req_id ) { wp_send_json_error('ID invalido.'); wp_die(); }
        $approver_assigned = get_post_meta( $req_id, 'sk_req_approver_id', true );
        $uid = get_current_user_id();
        $agent_id = intval( get_post_meta( $req_id, 'sk_req_agent_id', true ) );
        $amount = floatval( get_post_meta( $req_id, 'sk_req_amount', true ) );
        $is_admin = current_user_can('administrator') && empty(get_user_meta($uid,'salesking_group',true));
        $is_assigned = ( strval($approver_assigned) === strval($uid) );
        $is_ancestor = SK_CD_Routing::is_ancestor_of( $uid, $agent_id );
        $has_limit = ( SK_CD_Routing::get_agent_max_discount( $uid ) >= $amount );
        if ( ! $is_admin && ! $is_assigned && ! ( $is_ancestor && $has_limit ) ) {
            wp_send_json_error('Sin permiso o limite insuficiente.'); wp_die();
        }
        $status = get_post_meta( $req_id, 'sk_req_status', true );
        if ( $status !== 'pending' ) { wp_send_json_error('Ya procesada ('.$status.').'); wp_die(); }
        $customer_id = intval( get_post_meta( $req_id, 'sk_req_customer_id', true ) );
        $customer = get_userdata( $customer_id );
        if ( ! $customer ) { wp_send_json_error('Cliente no encontrado.'); wp_die(); }
        if ( ! class_exists('WC_Coupon') ) { wp_send_json_error('WooCommerce no disponible.'); wp_die(); }
        $coupon_code = strtoupper( 'AUTH-' . wp_generate_password(6,false,false) . '-' . $req_id );
        $coupon = new WC_Coupon();
        $coupon->set_code( $coupon_code );
        $coupon->set_discount_type( 'percent' );
        $coupon->set_amount( $amount );
        $coupon->set_usage_limit( 1 );
        $coupon->set_individual_use( true );
        $coupon->set_email_restrictions( array( $customer->user_email ) );
        $coupon->set_description( sprintf( 'Auth %s%% customer #%d agent #%d req #%d', $amount, $customer_id, $agent_id, $req_id ) );
        $coupon->save();
        update_post_meta( $req_id, 'sk_req_status', 'approved' );
        update_post_meta( $req_id, 'sk_req_coupon', $coupon_code );
        update_post_meta( $req_id, 'sk_req_approved_by', $uid );
        $agent = get_userdata( $agent_id );
        if ( $agent && $agent->user_email ) {
            wp_mail( $agent->user_email, 'Descuento Aprobado - ' . $amount . '%',
                sprintf( "Hola %s,\n\nTu solicitud del %s%% para %s fue aprobada.\nCupon: %s\nSe aplicara automaticamente.\n\nSaludos.",
                    $agent->display_name, $amount, $customer->display_name, $coupon_code ) );
        }
        wp_send_json_success( $coupon_code ); wp_die();
    }

    /* === AJAX: REJECT === */

    public function ajax_reject() {
        check_ajax_referer( 'sk_discount_action', 'nonce' );
        $req_id = intval( $_POST['req_id'] );
        if ( !$req_id ) { wp_send_json_error('ID invalido.'); wp_die(); }
        $status = get_post_meta( $req_id, 'sk_req_status', true );
        if ( $status !== 'pending' ) { wp_send_json_error('Ya procesada.'); wp_die(); }
        update_post_meta( $req_id, 'sk_req_status', 'rejected' );
        $agent_id = intval( get_post_meta( $req_id, 'sk_req_agent_id', true ) );
        $agent = get_userdata( $agent_id );
        $amount = get_post_meta( $req_id, 'sk_req_amount', true );
        if ( $agent && $agent->user_email ) {
            wp_mail( $agent->user_email, 'Solicitud Rechazada',
                sprintf("Hola %s,\n\nTu solicitud del %s%% fue rechazada.\n\nSaludos.", $agent->display_name, $amount) );
        }
        wp_send_json_success('Rechazada.'); wp_die();
    }

    /* === REPORTS PAGE === */

    public function render_reports_page() {
        $all = get_posts(array('post_type'=>'sk_discount_req','post_status'=>'publish','posts_per_page'=>-1));
        $total = count($all);
        $by_status = array('pending'=>0,'approved'=>0,'rejected'=>0);
        $by_agent = array(); $by_approver = array(); $pcts = array();
        $by_customer = array(); $by_month = array(); $coupons = array();
        foreach ($all as $r) {
            $st = get_post_meta($r->ID,'sk_req_status',true);
            $ai = get_post_meta($r->ID,'sk_req_agent_id',true);
            $ci = get_post_meta($r->ID,'sk_req_customer_id',true);
            $ap = get_post_meta($r->ID,'sk_req_approver_id',true);
            $am = floatval(get_post_meta($r->ID,'sk_req_amount',true));
            $cc = get_post_meta($r->ID,'sk_req_coupon',true);
            $dt = get_the_date('Y-m',$r->ID);
            if (isset($by_status[$st])) $by_status[$st]++;
            if (!isset($by_agent[$ai])) $by_agent[$ai]=array('t'=>0,'a'=>0,'r'=>0,'s'=>0);
            $by_agent[$ai]['t']++; $by_agent[$ai]['s']+=$am;
            if ($st==='approved') $by_agent[$ai]['a']++;
            if ($st==='rejected') $by_agent[$ai]['r']++;
            if ($st==='approved') {
                $ak=($ap==='admin')?'Super Admin':$ap;
                if(!isset($by_approver[$ak]))$by_approver[$ak]=0; $by_approver[$ak]++;
                $pcts[]=$am;
            }
            if(!isset($by_customer[$ci]))$by_customer[$ci]=0; $by_customer[$ci]++;
            if(!isset($by_month[$dt]))$by_month[$dt]=array('t'=>0,'a'=>0);
            $by_month[$dt]['t']++; if($st==='approved')$by_month[$dt]['a']++;
            if($st==='approved'&&$cc) $coupons[]=array('c'=>$cc,'p'=>$am,'ai'=>$ai,'ci'=>$ci,'d'=>get_the_date('Y-m-d',$r->ID));
        }
        $avg=count($pcts)?round(array_sum($pcts)/count($pcts),1):0;
        ksort($by_month); arsort($by_customer);
        uasort($by_agent,function($a,$b){return $b['t']-$a['t'];});
        ?>
        <div class="wrap">
        <h1>Reportes de Descuentos</h1>
        <h2>Resumen General</h2>
        <table class="widefat" style="max-width:500px;"><tbody>
            <tr><td><strong>Total</strong></td><td><?php echo $total;?></td></tr>
            <tr style="background:#d4edda;"><td><strong>Aprobadas</strong></td><td><?php echo $by_status['approved'];?></td></tr>
            <tr style="background:#f8d7da;"><td><strong>Rechazadas</strong></td><td><?php echo $by_status['rejected'];?></td></tr>
            <tr style="background:#fff3cd;"><td><strong>Pendientes</strong></td><td><?php echo $by_status['pending'];?></td></tr>
            <tr><td><strong>% Promedio</strong></td><td><?php echo $avg;?>%</td></tr>
            <tr><td><strong>Cupones</strong></td><td><?php echo count($coupons);?></td></tr>
        </tbody></table>
        <h2 style="margin-top:30px;">Por Agente</h2>
        <table class="widefat striped" style="max-width:800px;">
        <thead><tr><th>Agente</th><th>Total</th><th>Aprob.</th><th>Rech.</th><th>% Prom.</th><th>Tasa</th></tr></thead><tbody>
        <?php foreach($by_agent as $id=>$d):$u=get_userdata($id);$n=$u?$u->display_name:'#'.$id;
            $av=$d['t']?round($d['s']/$d['t'],1):0;$rt=$d['t']?round($d['a']/$d['t']*100):0;?>
            <tr><td><?php echo esc_html($n);?></td><td><?php echo $d['t'];?></td><td><?php echo $d['a'];?></td><td><?php echo $d['r'];?></td><td><?php echo $av;?>%</td><td><?php echo $rt;?>%</td></tr>
        <?php endforeach;?></tbody></table>
        <h2 style="margin-top:30px;">Por Autorizador</h2>
        <table class="widefat striped" style="max-width:500px;">
        <thead><tr><th>Autorizador</th><th>Aprob.</th></tr></thead><tbody>
        <?php foreach($by_approver as $k=>$c):$n=is_numeric($k)?(($u=get_userdata($k))?$u->display_name:'#'.$k):$k;?>
            <tr><td><?php echo esc_html($n);?></td><td><?php echo $c;?></td></tr>
        <?php endforeach;?></tbody></table>
        <h2 style="margin-top:30px;">Top Clientes</h2>
        <table class="widefat striped" style="max-width:500px;">
        <thead><tr><th>Cliente</th><th>Solicitudes</th></tr></thead><tbody>
        <?php foreach(array_slice($by_customer,0,10,true) as $id=>$c):$u=get_userdata($id);$n=$u?$u->display_name.' ('.$u->user_email.')':'#'.$id;?>
            <tr><td><?php echo esc_html($n);?></td><td><?php echo $c;?></td></tr>
        <?php endforeach;?></tbody></table>
        <h2 style="margin-top:30px;">Tendencia Mensual</h2>
        <table class="widefat striped" style="max-width:500px;">
        <thead><tr><th>Mes</th><th>Total</th><th>Aprob.</th></tr></thead><tbody>
        <?php foreach($by_month as $m=>$d):?>
            <tr><td><?php echo esc_html($m);?></td><td><?php echo $d['t'];?></td><td><?php echo $d['a'];?></td></tr>
        <?php endforeach;?></tbody></table>
        <h2 style="margin-top:30px;">Cupones Generados</h2>
        <?php if(empty($coupons)):?><p style="color:#888;">Sin cupones.</p>
        <?php else:?><table class="widefat striped" style="max-width:900px;">
        <thead><tr><th>Cupon</th><th>%</th><th>Agente</th><th>Cliente</th><th>Fecha</th></tr></thead><tbody>
        <?php foreach(array_reverse(array_slice($coupons,-20)) as $c):$au=get_userdata($c['ai']);$cu=get_userdata($c['ci']);?>
            <tr><td><code><?php echo esc_html($c['c']);?></code></td><td><?php echo $c['p'];?>%</td>
            <td><?php echo esc_html($au?$au->display_name:'#'.$c['ai']);?></td>
            <td><?php echo esc_html($cu?$cu->display_name:'#'.$c['ci']);?></td>
            <td><?php echo $c['d'];?></td></tr>
        <?php endforeach;?></tbody></table><?php endif;?>
        </div>
        <?php
    }
    /* === AJAX: CANCEL (agent cancels own request) === */

    public function ajax_cancel() {
        check_ajax_referer( 'sk_cancel_discount', 'nonce' );
        $req_id = intval( $_POST['req_id'] );
        if ( ! $req_id ) { wp_send_json_error('ID invalido.'); wp_die(); }
        $uid = get_current_user_id();
        $agent_id = intval( get_post_meta( $req_id, 'sk_req_agent_id', true ) );
        if ( $agent_id !== $uid ) { wp_send_json_error('Solo puedes cancelar tus propias solicitudes.'); wp_die(); }
        $status = get_post_meta( $req_id, 'sk_req_status', true );
        if ( $status !== 'pending' ) { wp_send_json_error('Solo se pueden cancelar solicitudes pendientes.'); wp_die(); }
        update_post_meta( $req_id, 'sk_req_status', 'cancelled' );
        wp_send_json_success('Cancelada.'); wp_die();
    }
}
new SK_CD_Dashboard();