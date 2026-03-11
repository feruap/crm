<?php
if (intval(get_option( 'salesking_agents_can_manage_orders_setting', 1 )) === 1){
    ?>
    <div class="nk-content salesking_orders_page">
        <div class="container-fluid">
            <div class="nk-content-inner">
                <div class="nk-content-body">
                    <div class="nk-block-head nk-block-head-sm">
                        <div class="nk-block-between">
                            <div class="nk-block-head-content">
                                <h3 class="nk-block-title page-title"><?php esc_html_e('Orders','salesking');?></h3>
                                <div class="nk-block-des text-soft">
                                    <p><?php esc_html_e('Here you can view and manage all orders assigned to you.', 'salesking');?></p>
                                </div>
                            </div><!-- .nk-block-head-content -->
                            <div class="nk-block-head-content">
                                <div class="toggle-wrap nk-block-tools-toggle">
                                    <a href="#" class="btn btn-icon btn-trigger toggle-expand mr-n1" data-target="more-options"><em class="icon ni ni-more-v"></em></a>
                                    <div class="toggle-expand-content" data-content="more-options">
                                        <ul class="nk-block-tools g-3">
                                            <li>
                                                <div class="form-control-wrap">
                                                    <div class="form-icon form-icon-right">
                                                        <em class="icon ni ni-search"></em>
                                                    </div>
                                                    <?php
                                                    $search = get_query_var('search');
                                                    ?>
                                                    <input type="text" class="form-control" id="salesking_orders_search" placeholder="<?php esc_html_e('Search orders...','salesking');?>" <?php if (!empty($search)){ echo 'value="'.$search.'"'; }?>>
                                                </div>
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                            </div><!-- .nk-block-head-content -->
                        </div><!-- .nk-block-between -->
                    </div><!-- .nk-block-head -->
                    <table id="salesking_dashboard_orders_table" class="nk-tb-list is-separate mb-3">
                        <thead>
                            <tr class="nk-tb-item nk-tb-head">
                                <th class="nk-tb-col"><span class="sub-text"><?php esc_html_e('Order','salesking'); ?></span></th>
                                <th class="nk-tb-col tb-col-md"><span class="sub-text"><?php esc_html_e('Date','salesking'); ?></span></th>
                                <th class="nk-tb-col tb-col-md"><span class="sub-text d-none d-mb-block"><?php esc_html_e('Status','salesking'); ?></span></th>
                                <th class="nk-tb-col tb-col-sm"><span class="sub-text"><?php esc_html_e('Customer','salesking'); ?></span></th>
                                <?php do_action('salesking_my_orders_custom_columns'); ?>

                                <th class="nk-tb-col tb-col-md"><span class="sub-text"><?php esc_html_e('Purchased','salesking'); ?></span></th>
                                <th class="nk-tb-col"><span class="sub-text"><?php esc_html_e('Order Total','salesking'); ?></span></th>
                                <?php 
                                    if (apply_filters('salesking_show_actions_my_orders_page', true)){
                                        ?>
                                            <th class="nk-tb-col"><span class="sub-text"><?php esc_html_e('Actions','salesking'); ?></span></th>
                                        <?php
                                    }
                                ?>
                            </tr>
                        </thead>
                        <?php
                        if (!apply_filters('salesking_load_orders_table_ajax', false)){
                            ?>
                            <tfoot>
                                <tr class="nk-tb-item nk-tb-head">
                                    <th class="nk-tb-col tb-col-md"><?php esc_html_e('order','salesking'); ?></th>
                                    <th class="nk-tb-col tb-col-md"><?php esc_html_e('date','salesking'); ?></th>
                                    <th class="nk-tb-col tb-col-md"><?php esc_html_e('status','salesking'); ?></th>
                                    <th class="nk-tb-col tb-col-md"><?php esc_html_e('customer','salesking'); ?></th>
                                    <?php do_action('salesking_my_orders_custom_columns_footer'); ?>
                                    <th class="nk-tb-col tb-col-md"><?php esc_html_e('purchased','salesking'); ?></th>
                                    <th class="nk-tb-col tb-col-md"><?php esc_html_e('order total','salesking'); ?></th>
                                    <?php 
                                        if (apply_filters('salesking_show_actions_my_orders_page', true)){
                                            ?>
                                                <th class="nk-tb-col tb-col-md"><?php esc_html_e('actions','salesking'); ?></th>
                                            <?php
                                        }
                                    ?>

                                </tr>
                            </tfoot>
                            <?php
                        }
                        ?>
                        <tbody>
                            <?php


                            if (!apply_filters('salesking_load_orders_table_ajax', false)){

                                $args = array(
                                    'limit' => -1,
                                    'type' => 'shop_order',
                                    'meta_key'      => 'salesking_assigned_agent', // Postmeta key field
                                    'meta_value'    => get_current_user_id(), // Postmeta value field
                                    'meta_compare'  => '=', // P
                                );

                                if (apply_filters('salesking_agents_see_all_orders', false)){
                                    // all orders
                                    $args = array(
                                        'limit' => -1,
                                        'type' => 'shop_order',
                                    );

                                }

                                $agent_orders = wc_get_orders( $args );

                                if (apply_filters('salesking_include_subagent_orders', false)){

                                    // get all subagents of the user (all users with this user as parent)
                                    $subagents = get_users(array(
                                    'fields' => 'ids',
                                    'meta_query'=> array(
                                          'relation' => 'AND',
                                          array(
                                            'meta_key'     => 'salesking_group',
                                            'meta_value'   => 'none',
                                            'meta_compare' => '!=',
                                           ),
                                          array(
                                              'key' => 'salesking_parent_agent',
                                              'value' => get_current_user_id(),
                                              'compare' => '=',
                                          ),
                                      )));


                                    foreach ($subagents as $subagent_id){
                                        $args = array(
                                            'limit' => -1,
                                            'type' => 'shop_order',
                                            'meta_key'      => 'salesking_assigned_agent', // Postmeta key field
                                            'meta_value'    => $subagent_id, // Postmeta value field
                                            'meta_compare'  => '=', // P
                                        );
                                        $temp_orders = wc_get_orders( $args );

                                        if (!empty($temp_orders)){
                                            $agent_orders = array_merge($agent_orders, $temp_orders);
                                        }
                                    }
                                }

                                foreach ($agent_orders as $order){
                                    $orderobj = $order;
                                    if ($orderobj !== false){
                                        ?>
                                        <tr class="nk-tb-item">
                                            <td class="nk-tb-col" data-order="<?php echo esc_html($orderobj->get_order_number());?>">

                                                <div>
                                                    <span class="tb-lead">#<?php echo esc_html($orderobj->get_order_number());?></span>
                                                </div>

                                            </td>
                                            <td class="nk-tb-col tb-col-md" data-order="<?php

                                                $date = $orderobj->get_date_created();
                                                echo $date->getTimestamp();

                                            ?>">
                                                <div>
                                                    <span class="tb-sub"><?php 
                                                    
                                                    echo $date->date_i18n( get_option('date_format'), $date->getTimestamp()+(get_option('gmt_offset')*3600) );

                                                    ?></span>
                                                </div>
                                            </td>
                                            <td class="nk-tb-col tb-col-md"> 
                                                <div >
                                                    <span class="dot bg-warning d-mb-none"></span>
                                                    <?php
                                                    $status = $orderobj->get_status();
                                                    $statustext = $badge = '';
                                                    if ($status === 'processing'){
                                                        $badge = 'badge-success';
                                                        $statustext = esc_html__('Processing','salesking');
                                                    } else if ($status === 'on-hold'){
                                                        $badge = 'badge-warning';
                                                        $statustext = esc_html__('On Hold','salesking');
                                                    } else if (in_array($status,apply_filters('salesking_earning_completed_statuses', array('completed')))){
                                                        $badge = 'badge-info';
                                                        $statustext = esc_html__('Completed','salesking');
                                                    } else if ($status === 'refunded'){
                                                        $badge = 'badge-gray';
                                                        $statustext = esc_html__('Refunded','salesking');
                                                    } else if ($status === 'cancelled'){
                                                        $badge = 'badge-gray';
                                                        $statustext = esc_html__('Cancelled','salesking');
                                                    } else if ($status === 'pending'){
                                                        $badge = 'badge-dark';
                                                        $statustext = esc_html__('Pending Payment','salesking');
                                                    } else if ($status === 'failed'){
                                                        $badge = 'badge-danger';
                                                        $statustext = esc_html__('Failed','salesking');
                                                    } else {
                                                        // custom status
                                                        $badge = 'badge-gray';
                                                        $wcstatuses = wc_get_order_statuses();
                                                        if (isset($wcstatuses['wc-'.$status])){
                                                            $statustext = $wcstatuses['wc-'.$status];
                                                        } else {
                                                            $statustext = '';
                                                        }
                                                    }
                                                    ?>
                                                    <span class="badge badge-sm badge-dot has-bg <?php echo esc_attr($badge);?> d-none d-mb-inline-flex"><?php
                                                    echo esc_html($statustext);
                                                    ?></span>
                                                </div>
                                            </td>
                                            <td class="nk-tb-col tb-col-sm">
                                                <div>
                                                     <span class="tb-sub"><?php
                                                     $customer_id = $orderobj -> get_customer_id();
                                                     $data = get_userdata($customer_id);
                                                     $name = $orderobj->get_billing_first_name().' '.$orderobj->get_billing_last_name();

                                                     // if guest user, show name by order
                                                     if ($data === false){
                                                        $name = $orderobj -> get_formatted_billing_full_name() . ' '.esc_html__('(guest user)','salesking');
                                                     }
                                                     $name = apply_filters('salesking_customers_page_name_display', $name, $customer_id, $orderobj);

                                                     echo $name;
                                                     ?></span>
                                                </div>
                                            </td>

                                            <?php do_action('salesking_my_orders_custom_columns_content', $orderobj); ?>

                                            <td class="nk-tb-col tb-col-md"> 
                                                <div>
                                                    <span class="tb-sub text-primary"><?php
                                                    $items = $orderobj->get_items();
                                                    $items_count = count( $items );
                                                    if ($items_count > apply_filters('salesking_dashboard_item_count_limit', 4)){
                                                        echo $items_count.' '.esc_html__('Items', 'salesking');
                                                    } else {
                                                        // show the items
                                                        foreach ($items as $item){
                                                            // Check if it has an offer name
                                                            $offer_name_key = esc_html__('Offer name','b2bking');
                                                            $offer_name = $item->get_meta($offer_name_key);
                                                            
                                                            // Start with the regular product name
                                                            $display_name = $item->get_name();
                                                            
                                                            // Add offer name in parentheses if available
                                                            if (!empty($offer_name)) {
                                                                $display_name .= ' (' . $offer_name . ')';
                                                            }
                                                            
                                                            echo apply_filters('salesking_item_display_dashboard', $display_name.' x '.$item->get_quantity().'<br>', $item);
                                                        }
                                                    }
                                                    ?></span>
                                                </div>
                                            </td>
                                            <td class="nk-tb-col" data-order="<?php echo esc_attr(apply_filters('salesking_orders_order_total', $orderobj->get_total(), $orderobj));?>"> 
                                                <div>
                                                    <span class="tb-lead"><?php echo wc_price(apply_filters('salesking_orders_order_total', $orderobj->get_total(), $orderobj), array('currency' => $orderobj->get_currency()));?></span>
                                                </div>
                                            </td>
                                            <?php 
                                                if (apply_filters('salesking_show_actions_my_orders_page', true)){
                                                    if (apply_filters('salesking_show_default_button_my_orders_page', true)){
                                                        ?>
                                                            <td class="nk-tb-col">
                                                                <div class="salesking_manage_order_container"> 
                                                                    <a href="<?php echo esc_attr($order->get_edit_order_url());?>"><button class="btn btn-sm btn-primary salesking_manage_order" value="<?php echo esc_attr($order->get_id());?>"><em class="icon ni ni-bag-fill"></em><span><?php esc_html_e('Manage Order','salesking');?></span></button></a>
                                                                </div>
                                                            </td>
                                                        <?php
                                                    }
                                                }

                                                do_action('salesking_my_orders_actions', $order);
                                            ?>
                                            
                                        </tr>
                                        <?php
                                    }
                                }

                            }
                            ?>
                            
                        </tbody>
                        
                    </table>
                </div>
            </div>
        </div>
    </div>
    <?php
}
?>