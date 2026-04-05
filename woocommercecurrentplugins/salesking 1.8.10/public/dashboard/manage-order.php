<?php

if (!defined('ABSPATH')) { exit; }

/*

SalesKing Dashboard Order Management Page
* @version 1.0.0

This template file can be edited and overwritten with your own custom template. To do this, simply copy this file under your theme (or child theme) folder, in a folder named 'salesking', and then edit it there. 

For example, if your theme is storefront, you can copy this file under wp-content/themes/storefront/salesking/ and then edit it with your own custom content and changes.

*/

?>
<?php
// Check if agent can manage orders
if (intval(get_option( 'salesking_agents_can_manage_orders_setting', 1 )) === 1){

    ?>
    <div class="nk-content salesking_manage_order_page">
        <div class="container-fluid">
            <div class="nk-content-inner">
                <div class="nk-content-body">
                    <form id="salesking_manage_order_form">
                    <?php
                    // Get order ID from URL path (e.g., /manage-order/123)
                    $current_url = $_SERVER['REQUEST_URI'];
                    $path_parts = explode('/', trim($current_url, '/'));
                    $order_id = '';
                    
                    // Find the order ID after 'manage-order'
                    $manage_order_index = array_search('manage-order', $path_parts);
                    if ($manage_order_index !== false && isset($path_parts[$manage_order_index + 1])) {
                        $order_id = sanitize_text_field($path_parts[$manage_order_index + 1]);
                    }
                    $user_id = get_current_user_id();
                    $order = wc_get_order($order_id);

                    if ($order){
                        
                        // Check that current agent is assigned to the order
                        $assigned_agent = $order->get_meta('salesking_assigned_agent');
                        if (intval($assigned_agent) === intval($user_id) || apply_filters('salesking_agents_see_all_orders', false)){
                            
                            if ($order) {
                                // has permission, continue
                                $post = $order;
                                global $theorder;
                                $theorder = $order;
                                ?>
             
                                <div class="nk-block-head nk-block-head-sm">
                                    <div class="nk-block-between g-3">
                                        <div class="nk-block-head-content">
                                            <h3 class="nk-block-title page-title"><?php esc_html_e('Order Details','salesking');?> / <strong class="text-primary small">#<?php 

                                            // sequential
                                            $order_nr_sequential = $order->get_meta('_order_number');
                                            if (!empty($order_nr_sequential)){
                                                echo esc_html($order_nr_sequential);
                                            } else {
                                                echo esc_html($order_id);
                                            }

                                            ?></strong></h3> 
                                            <?php do_action('salesking_after_order_details_text'); ?>

                                            <div class="nk-block-des text-soft">
                                                <ul class="list-inline">
                                                    <li><?php esc_html_e('Customer:','salesking');?> <span class="text-base"><?php echo apply_filters('salesking_order_page_customer_name', esc_html($order->get_formatted_billing_full_name()), $order);

                                                    ?></span></li>
                                                    <li><?php esc_html_e('Date:','salesking');?> <span class="text-base"><?php 
                                                    $date_created = $order->get_date_created();
                                                    echo $date_created->date_i18n( get_option('date_format'). ' ' . get_option('time_format'), $date_created->getTimestamp()+(get_option('gmt_offset')*3600) );
                                                     ?></span></li>
                                                </ul>
                                                <?php do_action('salesking_order_before_order_information'); ?>
                                            </div>
                                        </div>
                                        <div class="nk-block-head-content">
                                            <ul class="nk-block-tools g-3">
                                                
                                            <input type="hidden" id="salesking_save_order_button_id" value="<?php echo esc_attr($order_id);?>">
                                            
                                            <div id="salesking_save_order_button">
                                                <a href="#" class="toggle btn btn-icon btn-primary d-md-none"><em class="icon ni ni-edit-fill"></em></a>
                                                <a href="#" class="toggle btn btn-primary d-none d-md-inline-flex"><em class="icon ni ni-edit-fill"></em><span><?php esc_html_e('Update Order','salesking') ?></span></a>
                                            </div>
                                            
                                            <a href="<?php echo esc_attr(trailingslashit(get_page_link(apply_filters( 'wpml_object_id', get_option( 'salesking_agents_page_setting', 'disabled' ), 'post' , true)))).'orders';?>" class="salesking-order-back-button btn btn-icon btn-gray ml-2 text-white pl-2 pr-3"><em class="icon ni ni-arrow-left"></em><?php esc_html_e('Back','salesking'); ?></a>

                                            </ul>
                                        </div>
                                    </div>
                                </div><!-- .nk-block-head -->

                                <?php
                                if (isset($_GET['update'])){
                                    $add = sanitize_text_field($_GET['update']);;
                                    if ($add === 'success'){
                                        ?>                                    
                                        <div class="alert alert-primary alert-icon"><em class="icon ni ni-check-circle"></em> <strong><?php esc_html_e('The order has been updated successfully','salesking');?></strong>.</div>
                                        <?php
                                    }
                                }
                                ?>
                                <div class="nk-block">
                                    <div class="card">
                                        <div class="card-aside-wrap">
                                            <div class="card-content">
                                                <div class="card-inner">
                                                    <div class="nk-block">
                                                        <div class="nk-block-head">
                                                            <h5 class="title"><?php esc_html_e('Order Information','salesking');?></h5>
                                                            <?php do_action('salesking_after_order_information_text'); ?>

                                                        </div><!-- .nk-block-head -->
                                                        <div class="card card-preview">
                                                                <div class="row g-gs">
                                                                    <div class="col-lg-4">
                                                                        <div class="card">
                                                                            <h6 class="overline-title title salesking_order_item_title"><?php esc_html_e('General','salesking');?></h6>
                                                                            <div class="card-body">
                                                                                <?php echo esc_html__('Payment via:','salesking').' '.$order->get_payment_method_title();?><br><br>
                                                                                <?php echo esc_html__('Date:','salesking').' '.$date_created->date_i18n( get_option('date_format'), $date_created->getTimestamp()+(get_option('gmt_offset')*3600) );?><br><br>
                                                                                <div class="form-group">
                                                                                    <label class="form-label" for="salesking_order_status"><?php esc_html_e('Status','salesking');?></label>
                                                                                    <?php do_action('salesking_manage_order_after_status'); ?>
                                                                                    <div class="form-control-wrap">
                                                                                        <div class="form-control-select">
                                                                                            <select class="form-control" name="salesking_order_status" id="salesking_order_status">
                                                                                                <?php
                                                                                                $status = $order->get_status();
                                                                                                $wc_statuses = wc_get_order_statuses();
                                                                                                
                                                                                                // Show all order statuses (no limitations like MarketKing)
                                                                                                foreach ($wc_statuses as $status_key => $status_label) {
                                                                                                    $status_value = str_replace('wc-', '', $status_key);
                                                                                                    ?>
                                                                                                    <option value="<?php echo esc_attr($status_value); ?>" <?php selected($status, $status_value, true);?>><?php echo esc_html($status_label); ?></option>
                                                                                                    <?php
                                                                                                }
                                                                                                
                                                                                                do_action('salesking_order_statuses_custom', $user_id, $status);
                                                                                                ?>
                                                                                            </select>
                                                                                        </div>
                                                                                        <?php do_action('salesking_order_after_order_status'); ?>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    <div class="col-lg-4">
                                                                        <h6 class="overline-title title salesking_order_item_title"><?php esc_html_e('Billing','salesking');?></h6>
                                                                        <div class="card">
                                                                            <div class="card-body">
                                                                                <p class="card-text"><?php echo apply_filters('salesking_order_page_billing_address', $order->get_formatted_billing_address(), $order);?></p>
                                                                                <?php 

                                                                                if (apply_filters('salesking_agents_see_customer_contact_info', true, $order)){
                                                                                    if (!empty($order->get_billing_email())){
                                                                                        echo esc_html__('Email:','salesking').' '.$order->get_billing_email().'<br>';

                                                                                    }

                                                                                    if (!empty($order->get_billing_phone())){
                                                                                        echo esc_html__('Phone:','salesking').' '.$order->get_billing_phone();
                                                                                    }
                                                                                }

                                                                                do_action('salesking_order_after_phone', $order);

                                                                                ?>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    <div class="col-lg-4">
                                                                        <h6 class="overline-title title salesking_order_item_title"><?php esc_html_e('Shipping','salesking');?></h6>
                                                                        <div class="card">
                                                                            <div class="card-body">
                                                                                <p class="card-text"><?php echo apply_filters('salesking_order_page_shipping_address', $order->get_formatted_shipping_address(), $order);?></p>
                                                                                <?php
                                                                                $note = $order->get_customer_note();
                                                                                if (!empty($note)){
                                                                                    ?>
                                                                                    <p class="card-text"><strong><?php esc_html_e('Customer provided note:','salesking');?></strong><br><?php echo ' '.esc_html($note); ?></p>

                                                                                    <?php
                                                                                }

                                                                                do_action('salesking_order_after_shipping', $order);
                                                                                ?>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                            </div>
                                                        </div>
                                                        
                                                    </div><!-- .nk-block -->
                                                    <?php do_action('salesking_order_after_order_information'); ?>
                                                    <div class="nk-divider divider md"></div><div class="nk-block">
                                                        <?php do_action('salesking_order_before_order_items'); ?>

                                                        <div class="nk-block-head">
                                                            <h5 class="title"><?php esc_html_e('Order Items','salesking');?></h5>
                                                        </div><!-- .nk-block-head -->
                                                    </div><!-- .nk-block -->
                                                    <br>
                                                    <div id="woocommerce-order-items">
                                                        <?php WC_Meta_Box_Order_Items::output($post);  ?>
                                                    </div>

                                                    <?php
                                                    // Downloadable product permissions
                                                    if (apply_filters('salesking_enable_downloadable_product_permissions', false)){
                                                        ?>
                                                        <div class="nk-divider divider md"></div><div class="nk-block">
                                                            <div class="nk-block-head">
                                                                <h5 class="title"><?php esc_html_e('Downloadable Product Permissions','salesking');?></h5>
                                                            </div><!-- .nk-block-head -->
                                                        </div><!-- .nk-block -->
                                                        <br>
                                                        <div id="woocommerce-order-downloads">
                                                            <?php WC_Meta_Box_Order_Downloads::output($post);  ?>
                                                        </div>
                                                        <?php

                                                        do_action('salesking_after_downloadable_product_permissions', $order_id);
                                                    }
                                                   ?>
                                                    
                                                </div><!-- .card-inner -->
                                            </div><!-- .card-content -->
                                            <div id="salesking_order_notes_container" class="card-aside card-aside-right" data-content="userAside" data-toggle-screen="xxl" data-toggle-overlay="true" data-toggle-body="true">
                                                <div class="card-inner-group">
                                                    
                                                    <div class="card-inner">
                                                        <?php do_action('salesking_order_before_order_total'); ?>
                                                        <div class="overline-title-alt mb-2 salesking_order_totals_title"><?php esc_html_e('Order Totals','salesking');?></div>
                                                        <div class="profile-balance">
                                                            <div class="profile-balance-group gx-4">
                                                                <div class="profile-balance-sub">
                                                                    <div class="profile-balance-amount">
                                                                        <div class="number"><?php echo wc_price($order->get_total(), array('currency' => $order->get_currency()));?></div>
                                                                    </div>
                                                                    <div class="profile-balance-subtitle"><?php esc_html_e('Order Value','salesking');?></div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <?php do_action('salesking_order_after_order_total'); ?>
                                                    </div><!-- .card-inner -->

                                                    <div id="woocommerce-order-notes" class="card-inner">
                                                        <?php do_action('salesking_order_before_order_notes'); ?>

                                                        <h6 class="overline-title-alt mb-3"><?php esc_html_e('Order Notes','salesking');?></h6>
                                                        <?php WC_Meta_Box_Order_Notes::output($post);  ?>

                                                    </div><!-- .card-inner -->

                                                    <?php do_action('salesking_order_after_order_notes'); ?>

                                                    <div id="salesking_custom_boxes_area">
                                                    <?php
                                                        do_action('salesking_custom_boxes_area');
                                                    ?>
                                                    </div>
                                                </div><!-- .card-inner -->
                                            </div><!-- .card-aside -->
                                        </div><!-- .card-aside-wrap -->
                                    </div><!-- .card -->
                                </div><!-- .nk-block -->
                                <?php
                            }
                        } else {
                            // No permission
                            ?>
                            <div class="alert alert-warning alert-icon">
                                <em class="icon ni ni-alert-circle"></em> 
                                <strong><?php esc_html_e('Access Denied','salesking');?></strong> 
                                <?php esc_html_e('You do not have permission to manage this order.','salesking');?>
                            </div>
                            <?php
                        }
                    }

                    ?>
                    </form>
                </div>
            </div>
        </div>
    </div>
    <?php
} else {
    ?>
    <div class="nk-content">
        <div class="container-fluid">
            <div class="nk-content-inner">
                <div class="nk-content-body">
                    <?php
                    esc_html_e('Order management is not enabled for agents.','salesking');
                    ?>
                </div>
            </div>
        </div>
    </div>
    <?php
}
?>
