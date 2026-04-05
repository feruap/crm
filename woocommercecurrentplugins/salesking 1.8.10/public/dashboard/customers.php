<?php
    if (intval(apply_filters('salesking_enable_my_customers_page', 1)) === 1){
    ?>
    <div class="nk-content salesking_customers_page">
        <div class="container-fluid">
            <div class="nk-content-inner">
                <div class="nk-content-body">
                    <div class="nk-block-head nk-block-head-sm">
                        <div class="nk-block-between">
                            <div class="nk-block-head-content">
                                <h3 class="nk-block-title page-title">Mis Clientes</h3>
                                <div class="nk-block-des text-soft">
                                    <p>Clientes asignados a ti y a tus subagentes. Usa "Shop as Customer" para crear pedidos a su nombre.</p>
                                </div>
                            </div><!-- .nk-block-head-content -->
                            <div class="nk-block-head-content">
                                <div class="toggle-wrap nk-block-tools-toggle">
                                    <a href="#" class="btn btn-icon btn-trigger toggle-expand mr-n1" data-target="more-options"><em class="icon ni ni-more-v"></em></a>
                                    <div class="toggle-expand-content" data-content="more-options">
                                        <ul class="nk-block-tools g-3">
                                            <!-- Search moved to AJAX section below -->
                                            
                                            <?php
                                                if (apply_filters('salesking_default_add_customer', true)){
                                                    if (apply_filters('b2bking_show_customers_page_add_button', true)){
                                                        ?>
                                                        
                                                        <?php

                                                        require_once ( SALESKING_DIR . 'includes/class-salesking-helper.php' );
                                                        $helper = new Salesking_Helper();
                                                        if($helper->agent_can_add_more_customers($user_id)){
                                                            ?>
                                                            <li class="nk-block-tools-opt">
                                                                <a href="#" class="btn btn-icon btn-primary d-md-none" data-toggle="modal" data-target="#modal_add_customer"><em class="icon ni ni-plus"></em></a>
                                                                <button class="btn btn-primary d-none d-md-inline-flex" data-toggle="modal" data-target="#modal_add_customer"><em class="icon ni ni-plus"></em><span><?php esc_html_e('Add','salesking');?></span></button>
                                                            </li>
                                                            <?php
                                                        } else {
                                                            // show some error message that they reached the max nr of products
                                                            ?>
                                                            <button class="btn btn-primary d-none d-md-inline-flex" disabled="disabled"><em class="icon ni ni-plus"></em><span><?php esc_html_e('Add (Max Limit Reached)','salesking');?></span></button>

                                                            <?php
                                                        }
                                                    }
                                                } else {
                                                    do_action('salesking_alternative_add_customer');
                                                }
                                            ?>
                                        </ul>
                                    </div>
                                </div>
                            </div><!-- .nk-block-head-content -->
                        </div><!-- .nk-block-between -->
                    </div><!-- .nk-block-head -->
                    <?php
                    // Show pending transfer alert banner (computed later, output buffered via JS)
                    // We compute it inline since the pre-fetch happens below in the PHP flow
                    // Count pending transfers for this agent's hierarchy
                    $banner_pending_count = 0;
                    $banner_current_agent = get_current_user_id();
                    $banner_team_ids = array($banner_current_agent);
                    if (class_exists('Salesking_Admin') && method_exists('Salesking_Admin', 'get_recursive_team_ids')) {
                        $banner_team_ids = Salesking_Admin::get_recursive_team_ids($banner_current_agent, true);
                    }
                    $banner_team_map = array_flip(array_map('intval', $banner_team_ids));
                    global $wpdb;
                    $banner_opts = $wpdb->get_results(
                        "SELECT option_value FROM {$wpdb->options} WHERE option_name LIKE 'sk_transfer_%'"
                    );
                    foreach ($banner_opts as $bopt) {
                        $bdata = maybe_unserialize($bopt->option_value);
                        if (is_array($bdata) && isset($bdata['from_agent'])) {
                            if (isset($banner_team_map[intval($bdata['from_agent'])])) {
                                $banner_pending_count++;
                            }
                        }
                    }
                    if ($banner_pending_count > 0) {
                        ?>
                        <div class="alert" style="background:#fff3cd;border:1px solid #ffc107;border-radius:6px;padding:12px 18px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:14px;">
                            <span style="color:#856404;display:flex;align-items:center;gap:10px;">
                                <em class="icon ni ni-bell" style="font-size:20px;"></em>
                                <span>
                                    <strong>🔔 Tienes <?php echo intval($banner_pending_count); ?> solicitud<?php echo $banner_pending_count > 1 ? 'es' : ''; ?> de transferencia pendiente<?php echo $banner_pending_count > 1 ? 's' : ''; ?> de autorización.</strong>
                                </span>
                            </span>
                            <button type="button" class="btn btn-sm btn-warning" id="sk_filter_transfers" style="white-space:nowrap;">
                                <em class="icon ni ni-filter"></em> Ver solo transferencias
                            </button>
                        </div>
                        <script>
                        jQuery(document).ready(function($){
                            var filterActive = false;
                            $('#sk_filter_transfers').on('click', function(){
                                var table = $('#salesking_dashboard_customers_table');
                                if (!filterActive) {
                                    // Show only rows that have a transfer alert (yellow box)
                                    table.find('tbody tr').each(function(){
                                        if ($(this).find('.sk-transfer-alert').length === 0) {
                                            $(this).addClass('sk-hidden-by-filter').hide();
                                        }
                                    });
                                    $(this).html('<em class="icon ni ni-cross"></em> Mostrar todos');
                                    filterActive = true;
                                } else {
                                    table.find('tbody tr.sk-hidden-by-filter').removeClass('sk-hidden-by-filter').show();
                                    $(this).html('<em class="icon ni ni-filter"></em> Ver solo transferencias');
                                    filterActive = false;
                                }
                            });
                        });
                        </script>
                        <?php
                    }
                    ?>
                    <table id="salesking_dashboard_customers_table" class="nk-tb-list is-separate mb-3">
                        <thead>
                            <tr class="nk-tb-item nk-tb-head">
                                <th class="nk-tb-col"><span class="sub-text"><?php esc_html_e('Customer','salesking'); ?></span></th>
                                <?php
                                    if (apply_filters('b2bking_show_customers_page_company_column', true)){
                                        ?>
                                        <th class="nk-tb-col tb-col-md"><span class="sub-text"><?php esc_html_e('Company','salesking'); ?></span></th>
                                        <?php
                                    }
                                ?>
                                                                <th class="nk-tb-col tb-col-md"><span class="sub-text"><?php esc_html_e('Agente Asignado','salesking'); ?></span></th>
                                <?php
                                do_action('salesking_customers_custom_columns_header');
                                ?>
                                <?php
                                    if (apply_filters('b2bking_show_customers_page_total_spent_column', true)){
                                        ?>
                                        <th class="nk-tb-col tb-col-md"><span class="sub-text"><?php esc_html_e('Total Spend','salesking'); ?></span></th>

                                        <?php
                                    }

                                ?>
                                <?php
                                    if (apply_filters('b2bking_show_customers_page_order_count_column', true)){
                                        ?>
                                        <th class="nk-tb-col tb-col-lg"><span class="sub-text"><?php esc_html_e('Number of Orders','salesking'); ?></span></th>

                                        <?php
                                    }
                                ?>

                                <?php
                                    if (apply_filters('b2bking_show_customers_page_email_column', true)){
                                        ?>
                                        <th class="nk-tb-col tb-col-lg"><span class="sub-text"><?php esc_html_e('Email','salesking'); ?></span></th>
                                        <?php
                                    }
                                ?>
                                <?php
                                    if (apply_filters('b2bking_show_customers_page_phone_column', true)){
                                        ?>
                                        <th class="nk-tb-col tb-col-lg"><span class="sub-text"><?php esc_html_e('Phone','salesking'); ?></span></th>
                                        <?php
                                    }
                                ?> 
                                <?php
                                    if (apply_filters('salesking_show_customers_page_actions_column', true)){
                                        ?>                          
                                        <th class="nk-tb-col"><?php esc_html_e('Actions','salesking'); ?></span></th>
                                        <?php
                                    }
                                ?> 
                            </tr>
                        </thead>
                        <tbody>
                            <?php


                            if (!apply_filters('salesking_load_customers_table_ajax', false)){

                                // get all customers of the user

                                // if all agents can shop for all customers
                                if(intval(get_option( 'salesking_all_agents_shop_all_customers_setting', 0 ))=== 1){
                                    // first get all customers that have this assigned agent individually
                                    $user_ids_assigned = get_users(array(
                                        'fields' => 'ids',
                                    ));
                                    $customers = $user_ids_assigned;

                                } else {

                                    // first get all customers that have this assigned agent individually
                                    $user_ids_assigned = get_users(array(
                                                'meta_key'     => 'salesking_assigned_agent',
                                                'meta_value'   => $user_id,
                                                'meta_compare' => '=',
                                                'fields' => 'ids',
                                            ));


                                    if (defined('B2BKING_DIR') || defined('B2BKINGCORE_DIR')){
                                        // now get all b2bking groups that have this assigned agent
                                        $groups_with_agent = get_posts(array( 'post_type' => 'b2bking_group',
                                                  'post_status'=>'publish',
                                                  'numberposts' => -1,
                                                  'fields' => 'ids',
                                                  'meta_query'=> array(
                                                        'relation' => 'OR',
                                                        array(
                                                            'key' => 'salesking_assigned_agent',
                                                            'value' => $user_id,
                                                            'compare' => '=',
                                                        ),
                                                    )));

                                    } else {
                                        $groups_with_agent = array();
                                    }

                                    if (!empty($groups_with_agent)){
                                        // get all customers in the above groups with agent
                                        $user_ids_in_groups_with_agent = get_users(array(
                                                    'meta_key'     => 'b2bking_customergroup',
                                                    'meta_value'   => $groups_with_agent,
                                                    'meta_compare' => 'IN',
                                                    'fields' => 'ids',
                                                ));

                                        // for all customers with this agent as group, make sure they don't have a different agent individually
                                        foreach ($user_ids_in_groups_with_agent as $array_key => $user_id){
                                            // check that a different agent is not assigned
                                            $assigned_agent = get_user_meta($user_id,'salesking_assigned_agent', true);

                                            if (!empty($assigned_agent) && $assigned_agent !== $user_id && $assigned_agent !== 'none'){
                                                unset($user_ids_in_groups_with_agent[$array_key]);
                                            }
                                        }


                                        $customers = array_merge($user_ids_assigned, $user_ids_in_groups_with_agent);
                                    } else {
                                        $customers = $user_ids_assigned;
                                    }

                                    if (apply_filters('salesking_include_subagent_customers', false)){

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
                                            $temp_users = get_users(array(
                                                        'meta_key'     => 'salesking_assigned_agent',
                                                        'meta_value'   => $subagent_id,
                                                        'meta_compare' => '=',
                                                        'fields' => 'ids',
                                                    ));


                                            if (!empty($temp_users)){
                                                $customers = array_merge($customers, $temp_users);
                                            }
                                        }
                                    }
                                }

                                // additional agents
                                if (apply_filters('salesking_use_additional_agents', false)){

                                    $additional_customers = array();
                                    $all_ids = get_users(array(
                                        'fields' => 'ids',
                                    ));

                                    foreach ($all_ids as $random_customer_id){
                                        $selected_options_string = get_user_meta($random_customer_id, 'salesking_additional_agents', true);
                                        $selected_options = explode(',', $selected_options_string);
                                        if (in_array(get_current_user_id(), $selected_options)){
                                            array_push($additional_customers, $random_customer_id);
                                        }
                                    }

                                    $customers = array_unique(array_filter(array_merge($customers, $additional_customers)));
                                }

                                $customers = apply_filters('salesking_customers_agent_dashboard', $customers, get_current_user_id());

                                // Transfer system: determine ownership by direct agent assignment only
                                $current_agent_id = get_current_user_id();
                                global $wpdb;

                                // 1. MY customers (assigned directly to me)
                                $my_customer_ids = get_users(array(
                                    'meta_key'     => 'salesking_assigned_agent',
                                    'meta_value'   => $current_agent_id,
                                    'meta_compare' => '=',
                                    'fields'       => 'ids',
                                ));

                                // Pre-fetch: current user's direct children (subagents)
                                // Note: use $current_agent_id instead of $user_id which may be overwritten by B2BKING loop
                                $my_children_ids = get_users(array(
                                    'fields' => 'ids',
                                    'meta_query' => array(
                                        'relation' => 'AND',
                                        array('key' => 'salesking_group', 'value' => 'none', 'compare' => '!='),
                                        array('key' => 'salesking_parent_agent', 'value' => $current_agent_id, 'compare' => '='),
                                    ),
                                ));
                                $my_children_ids_map = array_flip(array_map('strval', $my_children_ids));

                                // Pre-fetch: pending transfer requests involving current user or their team
                                $user_id = $current_agent_id; // Restore $user_id for use below
                                // Build hierarchy: all agent IDs in this user's team tree (self + descendants)
                                $my_team_ids = array($current_agent_id);
                                if (class_exists('Salesking_Admin') && method_exists('Salesking_Admin', 'get_recursive_team_ids')) {
                                    $my_team_ids = Salesking_Admin::get_recursive_team_ids($current_agent_id, true);
                                }
                                $my_team_ids_map = array_flip(array_map('intval', $my_team_ids));

                                global $wpdb;
                                $sk_transfer_options = $wpdb->get_results(
                                    "SELECT option_name, option_value FROM {$wpdb->options} WHERE option_name LIKE 'sk_transfer_%'"
                                );
                                $pending_requests_for_me = array(); // requests where from_agent is me or my descendant (I can authorize)
                                $pending_requests_by_me  = array(); // requests I made (I want someone's customer)
                                foreach ($sk_transfer_options as $opt) {
                                    $data = maybe_unserialize($opt->option_value);
                                    if (is_array($data)) {
                                        // I can authorize if from_agent is me or any agent in my team tree
                                        if (isset($my_team_ids_map[intval($data['from_agent'])])) {
                                            $pending_requests_for_me[] = $data;
                                        }
                                        if (intval($data['to_agent']) === intval($user_id)) {
                                            $pending_requests_by_me[] = $data;
                                        }
                                    }
                                }

                                // 2. Customers of my sub-agents (so I can reassign them)
                                $children_customer_ids = array();
                                if (!empty($my_children_ids)) {
                                    $children_customer_ids = get_users(array(
                                        'meta_key'     => 'salesking_assigned_agent',
                                        'meta_value'   => $my_children_ids,
                                        'meta_compare' => 'IN',
                                        'fields'       => 'ids',
                                    ));
                                }

                                // 3. Customers involved in pending transfer requests (so I can see/act on them)
                                $transfer_customer_ids = array();
                                foreach (array_merge($pending_requests_for_me, $pending_requests_by_me) as $req) {
                                    if (!empty($req['customer_id'])) {
                                        $transfer_customer_ids[] = intval($req['customer_id']);
                                    }
                                }

                                // Build final list: only relevant customers (NOT all users)
                                $customers = array_unique(array_merge(
                                    $my_customer_ids,
                                    $children_customer_ids,
                                    $transfer_customer_ids
                                ));

                                // PERFORMANCE: Bulk pre-fetch order stats for all customers in one query
                                $customer_ids_str = implode(',', array_map('intval', $customers));
                                $bulk_order_stats = array();
                                if (!empty($customer_ids_str)) {
                                    // Get total spent and order count from WC order meta in bulk
                                    $order_stats_results = $wpdb->get_results(
                                        "SELECT pm_customer.meta_value as customer_id,
                                                COUNT(DISTINCT p.ID) as order_count,
                                                COALESCE(SUM(pm_total.meta_value), 0) as total_spent
                                         FROM {$wpdb->posts} p
                                         INNER JOIN {$wpdb->postmeta} pm_customer ON p.ID = pm_customer.post_id AND pm_customer.meta_key = '_customer_user'
                                         LEFT JOIN {$wpdb->postmeta} pm_total ON p.ID = pm_total.post_id AND pm_total.meta_key = '_order_total'
                                         WHERE p.post_type IN ('shop_order', 'shop_order_placehold')
                                         AND p.post_status IN ('wc-completed','wc-processing','wc-on-hold')
                                         AND pm_customer.meta_value IN ({$customer_ids_str})
                                         GROUP BY pm_customer.meta_value"
                                    );
                                    foreach ($order_stats_results as $stat) {
                                        $bulk_order_stats[intval($stat->customer_id)] = array(
                                            'order_count' => intval($stat->order_count),
                                            'total_spent' => floatval($stat->total_spent),
                                        );
                                    }
                                }

                                foreach ($customers as $customer_id){
                                    $user_info = get_userdata($customer_id);
                                    if (!$user_info) continue; // Skip invalid users
                                    $company_name = get_user_meta($customer_id,'billing_company', true);
                                    if (empty($company_name)){
                                        $company_name = '';
                                    }
                                    // Use pre-fetched order stats instead of expensive WC_Customer
                                    $customer_total_spent = isset($bulk_order_stats[$customer_id]) ? $bulk_order_stats[$customer_id]['total_spent'] : 0;
                                    $customer_order_count = isset($bulk_order_stats[$customer_id]) ? $bulk_order_stats[$customer_id]['order_count'] : 0;

                                    if (empty($user_info->first_name) && empty($user_info->last_name)){
                                        $name = $user_info->user_login;
                                    } else {
                                        $name = $user_info->first_name.' '.$user_info->last_name;
                                    }
                                    $name = apply_filters('salesking_customers_page_name_display', $name, $customer_id);

                                    ?>
                                    <tr class="nk-tb-item">
                                            <td class="nk-tb-col">

                                                <div>
                                                    <div class="user-card">
                                                        <div class="user-avatar bg-primary">
                                                            <span><?php echo esc_html(substr($name, 0, 2));?></span>
                                                        </div>
                                                        <div class="user-info">
                                                            <span class="tb-lead"><?php echo esc_html($name);?> <span class="dot dot-success d-md-none ml-1"></span></span>
                                                        </div>
                                                    </div>
                                                </div>

                                            </td>
                                            <?php
                                                if (apply_filters('b2bking_show_customers_page_company_column', true)){
                                                    ?>
                                                    <td class="nk-tb-col tb-col-md">
                                                        <div>
                                                            <span><?php echo esc_html($company_name);?></span>
                                                        </div>
                                                    </td>
                                                    <?php
                                                }
                                            ?>
                                                                                        <?php
                                            // Agente Asignado column
                                            $customer_assigned_agent = get_user_meta($customer_id, 'salesking_assigned_agent', true);
                                            $agent_display_name = '-';
                                            if (!empty($customer_assigned_agent)) {
                                                $agent_info = get_userdata(intval($customer_assigned_agent));
                                                if ($agent_info) {
                                                    $agent_display_name = $agent_info->first_name . ' ' . $agent_info->last_name;
                                                    if (trim($agent_display_name) === '') $agent_display_name = $agent_info->user_login;
                                                }
                                            }
                                            $is_my_customer = in_array($customer_id, $my_customer_ids);
                                            ?>
                                            <td class="nk-tb-col tb-col-md">
                                                <div>
                                                    <span<?php echo $is_my_customer ? ' style="color:#1ee0ac;font-weight:600;"' : ''; ?>><?php echo esc_html($agent_display_name); ?></span>
                                                    <?php if ($is_my_customer) { ?><em class="icon ni ni-check-circle" style="color:#1ee0ac;margin-left:4px;" title="Tu cliente"></em><?php } ?>
                                                </div>
                                            </td>
                                            <?php
                                            do_action('salesking_customers_custom_columns_content', $customer_id);

                                                if (apply_filters('b2bking_show_customers_page_total_spent_column', true)){
                                                    ?>
                                                    <td class="nk-tb-col tb-col-md" data-order="<?php echo esc_attr($customer_total_spent);?>">
                                                        <div>
                                                            <span class="tb-amount"><?php echo wc_price($customer_total_spent);?></span>
                                                        </div>
                                                    </td>
                                                    <?php
                                                }
                                            ?>
                                            <?php
                                                if (apply_filters('b2bking_show_customers_page_order_count_column', true)){
                                                    ?>
                                                    <td class="nk-tb-col tb-col-lg">
                                                        <div>
                                                            <?php
                                                            if (apply_filters('salesking_customers_show_orders_link', false)){
                                                                ?>
                                                                <a class="salesking_clickable_highlight" href="<?php echo esc_attr(trailingslashit(get_page_link(apply_filters( 'wpml_object_id', get_option( 'salesking_agents_page_setting', 'disabled' ), 'post' , true)))) .'orders/?search='.$user_info->user_email; ?>">
                                                                <?php
                                                            }
                                                            ?>

                                                            <span class="tb-amount"><?php echo $customer_order_count;?></span>
                                                            <?php

                                                            if (apply_filters('salesking_customers_show_orders_link', false)){
                                                                ?>
                                                                </a>
                                                                <?php
                                                            }
                                                            ?>
                                                        </div>
                                                    </td>
                                                    <?php
                                                }
                                            ?>
                                            
                                            
                                            <?php /*
                                            <td class="nk-tb-col tb-col-lg" data-order="<?php 
                                            $last_order = $customerobj->get_last_order();
                                            if (is_a($last_order, 'WC_Order')){
                                                $date = explode('T',$last_order->get_date_created())[0];
                                                echo esc_attr(strtotime($date));
                                            }
                                            ?>"> 
                                                <div>
                                                    <span><?php 
                                                    if (is_a($last_order, 'WC_Order')){
                                                        $date = ucfirst(date_i18n('F j, Y', strtotime($date)));

                                                        echo $date;
                                                    }?></span>
                                                </div>
                                            </td>
                                            */?>
                                            <?php
                                                if (apply_filters('b2bking_show_customers_page_email_column', true)){
                                                    ?>
                                                    <td class="nk-tb-col tb-col-lg">
                                                        <div>
                                                            <span><?php echo esc_html($user_info->user_email);?></span>
                                                        </div>
                                                    </td>
                                                    <?php
                                                }
                                            ?>
                                            <?php
                                                if (apply_filters('b2bking_show_customers_page_phone_column', true)){
                                                    ?>
                                                    <td class="nk-tb-col tb-col-lg"> 
                                                        <div >
                                                            <span><?php echo esc_html(get_user_meta($customer_id,'billing_phone', true));?></span>
                                                        </div>
                                                    </td>
                                                    <?php
                                                }
                                            ?>
                                            
                                            <?php
                                                if (apply_filters('salesking_show_customers_page_actions_column', true)){
                                                        ?>
                                                        <td class="nk-tb-col">
                                                        <?php
                                                        if ($is_my_customer) {
                                                            // MY customer: show Shop + Edit buttons
                                                            ?>
                                                            <div class="tb-odr-btns d-md-inline">
                                                                <button class="btn btn-sm btn-primary salesking_shop_as_customer" value="<?php echo esc_attr($customer_id);?>"><em class="icon ni ni-cart-fill"></em><span><?php esc_html_e('Shop as Customer','salesking');?></span></button>
                                                            </div>
                                                            <?php
                                                            if (intval(get_option( 'salesking_agents_can_edit_customers_setting', 1 )) === 1){
                                                                ?>
                                                                <div class="tb-odr-btns d-none d-md-inline">
                                                                    <button class="btn btn-sm btn-secondary salesking_shop_as_customer_edit" value="<?php echo esc_attr($customer_id);?>"><em class="icon ni ni-pen-alt-fill"></em><span><?php echo apply_filters('salesking_shop_customer_edit_button_text', esc_html__('Edit','salesking'));?></span></button>
                                                                </div>
                                                                <?php
                                                            }

                                                            // Check for incoming transfer requests on MY customer
                                                            $incoming_for_customer = array_filter($pending_requests_for_me, function($r) use ($customer_id){
                                                                return intval($r['customer_id']) === intval($customer_id);
                                                            });
                                                            foreach ($incoming_for_customer as $req) {
                                                                $requester_info = get_userdata(intval($req['to_agent']));
                                                                $requester_name = $requester_info ? ($requester_info->first_name . ' ' . $requester_info->last_name) : 'Agente #'.$req['to_agent'];
                                                                if (trim($requester_name) === '') $requester_name = $requester_info->user_login;
                                                                $current_owner_info = get_userdata(intval($req['from_agent']));
                                                                $current_owner_name = $current_owner_info ? trim($current_owner_info->first_name . ' ' . $current_owner_info->last_name) : '';
                                                                if (empty($current_owner_name) && $current_owner_info) $current_owner_name = $current_owner_info->user_login;
                                                                ?>
                                                                <div class="sk-transfer-alert" style="margin-top:6px;padding:8px 10px;background:#fff3cd;border-radius:5px;font-size:12px;border:1px solid #ffc107;">
                                                                    <span>🔔 <strong><?php echo esc_html($requester_name); ?></strong> solicita este cliente</span>
                                                                    <?php if (intval($req['from_agent']) !== $current_agent_id) { ?>
                                                                        <br><span style="font-size:11px;color:#666;">Agente actual: <strong><?php echo esc_html($current_owner_name); ?></strong></span>
                                                                    <?php } ?>
                                                                    <br>
                                                                    <button class="btn btn-sm btn-success salesking_respond_transfer" data-customer="<?php echo esc_attr($customer_id);?>" data-requester="<?php echo esc_attr($req['to_agent']);?>" data-response="accept" style="margin-top:4px;padding:2px 10px;font-size:11px;">✅ Aceptar</button>
                                                                    <button class="btn btn-sm btn-danger salesking_respond_transfer" data-customer="<?php echo esc_attr($customer_id);?>" data-requester="<?php echo esc_attr($req['to_agent']);?>" data-response="reject" style="margin-top:4px;padding:2px 10px;font-size:11px;">❌ Rechazar</button>
                                                                </div>
                                                                <?php
                                                            }

                                                            do_action('salesking_customers_action_buttons', $customer_id);

                                                        } else if (!empty($customer_assigned_agent) && isset($my_children_ids_map[strval($customer_assigned_agent)])) {
                                                            // Customer belongs to MY CHILD: direct reassign (no approval)
                                                            ?>
                                                            <div class="tb-odr-btns d-md-inline">
                                                                <button class="btn btn-sm btn-warning salesking_direct_reassign" value="<?php echo esc_attr($customer_id);?>" title="Reasignar este cliente de tu subagente a ti"><em class="icon ni ni-exchange"></em><span><?php esc_html_e('Reasignar','salesking');?></span></button>
                                                            </div>
                                                            <?php
                                                            // Show pending transfer requests for this child's customer (parent can authorize)
                                                            $incoming_child = array_filter($pending_requests_for_me, function($r) use ($customer_id){
                                                                return intval($r['customer_id']) === intval($customer_id);
                                                            });
                                                            foreach ($incoming_child as $req) {
                                                                $requester_info = get_userdata(intval($req['to_agent']));
                                                                $requester_name = $requester_info ? trim($requester_info->first_name . ' ' . $requester_info->last_name) : 'Agente #'.$req['to_agent'];
                                                                if (empty($requester_name) && $requester_info) $requester_name = $requester_info->user_login;
                                                                $child_agent_info = get_userdata(intval($req['from_agent']));
                                                                $child_agent_name = $child_agent_info ? trim($child_agent_info->first_name . ' ' . $child_agent_info->last_name) : '';
                                                                if (empty($child_agent_name) && $child_agent_info) $child_agent_name = $child_agent_info->user_login;
                                                                ?>
                                                                <div class="sk-transfer-alert" style="margin-top:6px;padding:8px 10px;background:#fff3cd;border-radius:5px;font-size:12px;border:1px solid #ffc107;">
                                                                    <span>🔔 <strong><?php echo esc_html($requester_name); ?></strong> solicita este cliente</span>
                                                                    <br><span style="font-size:11px;color:#666;">Agente actual: <strong><?php echo esc_html($child_agent_name); ?></strong> (tu subagente)</span>
                                                                    <br>
                                                                    <button class="btn btn-sm btn-success salesking_respond_transfer" data-customer="<?php echo esc_attr($customer_id);?>" data-requester="<?php echo esc_attr($req['to_agent']);?>" data-response="accept" style="margin-top:4px;padding:2px 10px;font-size:11px;">✅ Aceptar</button>
                                                                    <button class="btn btn-sm btn-danger salesking_respond_transfer" data-customer="<?php echo esc_attr($customer_id);?>" data-requester="<?php echo esc_attr($req['to_agent']);?>" data-response="reject" style="margin-top:4px;padding:2px 10px;font-size:11px;">❌ Rechazar</button>
                                                                </div>
                                                                <?php
                                                            }

                                                        } else if (empty($customer_assigned_agent) || $customer_assigned_agent === 'none' || $customer_assigned_agent === '0') {
                                                            // Customer has NO agent assigned: allow immediate claim
                                                            ?>
                                                            <div class="tb-odr-btns d-md-inline">
                                                                <button class="btn btn-sm btn-success salesking_claim_customer" value="<?php echo esc_attr($customer_id);?>" title="Asignar este cliente sin agente a ti"><em class="icon ni ni-user-add"></em><span><?php esc_html_e('Asignar a mí','salesking');?></span></button>
                                                            </div>
                                                            <?php

                                                        } else {
                                                            // NOT my customer, NOT my child's: request transfer
                                                            $already_requested = array_filter($pending_requests_by_me, function($r) use ($customer_id){
                                                                return intval($r['customer_id']) === intval($customer_id);
                                                            });
                                                            if (!empty($already_requested)) {
                                                                ?>
                                                                <div class="tb-odr-btns d-md-inline">
                                                                    <button class="btn btn-sm btn-outline-secondary" disabled><em class="icon ni ni-clock"></em><span>⏳ Solicitud enviada</span></button>
                                                                </div>
                                                                <?php
                                                            } else {
                                                                ?>
                                                                <div class="tb-odr-btns d-md-inline">
                                                                    <button class="btn btn-sm btn-info salesking_request_transfer" value="<?php echo esc_attr($customer_id);?>"><em class="icon ni ni-swap"></em><span><?php esc_html_e('Solicitar Transferencia','salesking');?></span></button>
                                                                </div>
                                                                <?php
                                                            }
                                                        }

                                                        // UNIVERSAL: Show transfer alerts for ANY customer in my team tree
                                                        // This covers grandchildren and deeper hierarchy levels
                                                        if (!$is_my_customer && !isset($my_children_ids_map[strval($customer_assigned_agent)])) {
                                                            $team_incoming = array_filter($pending_requests_for_me, function($r) use ($customer_id){
                                                                return intval($r['customer_id']) === intval($customer_id);
                                                            });
                                                            foreach ($team_incoming as $req) {
                                                                $requester_info = get_userdata(intval($req['to_agent']));
                                                                $requester_name = $requester_info ? trim($requester_info->first_name . ' ' . $requester_info->last_name) : 'Agente #'.$req['to_agent'];
                                                                if (empty($requester_name) && $requester_info) $requester_name = $requester_info->user_login;
                                                                $team_owner_info = get_userdata(intval($req['from_agent']));
                                                                $team_owner_name = $team_owner_info ? trim($team_owner_info->first_name . ' ' . $team_owner_info->last_name) : '';
                                                                if (empty($team_owner_name) && $team_owner_info) $team_owner_name = $team_owner_info->user_login;
                                                                ?>
                                                                <div class="sk-transfer-alert" style="margin-top:6px;padding:8px 10px;background:#fff3cd;border-radius:5px;font-size:12px;border:1px solid #ffc107;">
                                                                    <span>🔔 <strong><?php echo esc_html($requester_name); ?></strong> solicita este cliente</span>
                                                                    <br><span style="font-size:11px;color:#666;">Agente actual: <strong><?php echo esc_html($team_owner_name); ?></strong></span>
                                                                    <br>
                                                                    <button class="btn btn-sm btn-success salesking_respond_transfer" data-customer="<?php echo esc_attr($customer_id);?>" data-requester="<?php echo esc_attr($req['to_agent']);?>" data-response="accept" style="margin-top:4px;padding:2px 10px;font-size:11px;">✅ Aceptar</button>
                                                                    <button class="btn btn-sm btn-danger salesking_respond_transfer" data-customer="<?php echo esc_attr($customer_id);?>" data-requester="<?php echo esc_attr($req['to_agent']);?>" data-response="reject" style="margin-top:4px;padding:2px 10px;font-size:11px;">❌ Rechazar</button>
                                                                </div>
                                                                <?php
                                                            }
                                                        }
                                                        ?>
                                                        </td>
                                                        <?php
                                                }
                                            ?>
                                    </tr>
                                    <?php
                                }
                            }
                            ?>
                        </tbody>
                    </table>

                    <!-- SECTION 2: Search other customers (AJAX, secure) -->
                    <div class="nk-block-head nk-block-head-sm" style="margin-top:30px;">
                        <div class="nk-block-between">
                            <div class="nk-block-head-content">
                                <h5 class="nk-block-title">🔍 Buscar otro cliente</h5>
                                <p class="text-soft" style="font-size:13px;">Escribe mínimo 3 caracteres para buscar. Se muestran máximo 3 resultados.</p>
                            </div>
                        </div>
                    </div>
                    <div style="max-width:400px;margin-bottom:12px;">
                        <div class="form-control-wrap">
                            <div class="form-icon form-icon-right"><em class="icon ni ni-search"></em></div>
                            <input type="text" class="form-control" id="sk_global_customer_search" placeholder="Nombre, email o teléfono..." autocomplete="off">
                        </div>
                    </div>
                    <div id="sk_search_results" style="display:none;">
                        <table class="nk-tb-list is-separate mb-3" style="width:100%;">
                            <thead>
                                <tr class="nk-tb-item nk-tb-head">
                                    <th class="nk-tb-col"><span class="sub-text">Cliente</span></th>
                                    <th class="nk-tb-col tb-col-md"><span class="sub-text">Email</span></th>
                                    <th class="nk-tb-col tb-col-md"><span class="sub-text">Agente Asignado</span></th>
                                    <th class="nk-tb-col"><span class="sub-text">Acciones</span></th>
                                </tr>
                            </thead>
                            <tbody id="sk_search_results_body"></tbody>
                        </table>
                    </div>
                    <div id="sk_search_empty" style="display:none;padding:12px;color:#999;font-size:13px;">
                        Sin resultados para esta búsqueda.
                    </div>
                    <div id="sk_search_loading" style="display:none;padding:12px;">
                        <span class="spinner-border spinner-border-sm" role="status"></span> Buscando...
                    </div>

                    <script>
                    jQuery(document).ready(function($){
                        var searchTimer = null;
                        $('#sk_global_customer_search').on('keyup', function(){
                            clearTimeout(searchTimer);
                            var val = $(this).val().trim();
                            if (val.length < 3) {
                                $('#sk_search_results, #sk_search_empty, #sk_search_loading').hide();
                                return;
                            }
                            $('#sk_search_loading').show();
                            $('#sk_search_results, #sk_search_empty').hide();
                            searchTimer = setTimeout(function(){
                                $.ajax({
                                    url: '<?php echo admin_url("admin-ajax.php"); ?>',
                                    type: 'POST',
                                    data: {
                                        action: 'salesking_search_customers',
                                        security: '<?php echo wp_create_nonce("salesking_security_nonce"); ?>',
                                        search: val
                                    },
                                    success: function(resp){
                                        $('#sk_search_loading').hide();
                                        if (resp.success && resp.data.length > 0) {
                                            var html = '';
                                            resp.data.forEach(function(c){
                                                html += '<tr class="nk-tb-item">';
                                                html += '<td class="nk-tb-col"><div class="user-card"><div class="user-avatar bg-primary" style="width:32px;height:32px;font-size:12px;"><span>' + c.name.substring(0,2) + '</span></div><div class="user-info"><span class="tb-lead">' + c.name + '</span>';
                                                if (c.company) html += '<br><small class="text-soft">' + c.company + '</small>';
                                                html += '</div></div></td>';
                                                html += '<td class="nk-tb-col tb-col-md"><span>' + c.email + '</span></td>';
                                                var agentStyle = c.action === 'claim' ? 'color:#e85347;font-weight:600;' : '';
                                                html += '<td class="nk-tb-col tb-col-md"><span style="' + agentStyle + '">' + c.agent_name + '</span></td>';
                                                html += '<td class="nk-tb-col">';
                                                if (c.action === 'mine') {
                                                    html += '<span class="badge badge-success" style="background:#1ee0ac;padding:4px 10px;">✓ Tu cliente</span>';
                                                } else if (c.action === 'claim') {
                                                    html += '<button class="btn btn-sm btn-success salesking_claim_customer" value="' + c.id + '"><em class="icon ni ni-user-add"></em> Asignar a mí</button>';
                                                } else if (c.action === 'reassign') {
                                                    html += '<button class="btn btn-sm btn-warning salesking_direct_reassign" value="' + c.id + '"><em class="icon ni ni-exchange"></em> Reasignar</button>';
                                                } else if (c.action === 'pending') {
                                                    html += '<button class="btn btn-sm btn-outline-secondary" disabled><em class="icon ni ni-clock"></em> ⏳ Solicitud enviada</button>';
                                                } else if (c.action === 'transfer') {
                                                    html += '<button class="btn btn-sm btn-info salesking_request_transfer" value="' + c.id + '"><em class="icon ni ni-swap"></em> Solicitar Transferencia</button>';
                                                }
                                                html += '</td></tr>';
                                            });
                                            $('#sk_search_results_body').html(html);
                                            $('#sk_search_results').show();
                                            $('#sk_search_empty').hide();
                                        } else {
                                            $('#sk_search_results').hide();
                                            $('#sk_search_empty').show();
                                        }
                                    },
                                    error: function(){
                                        $('#sk_search_loading').hide();
                                        $('#sk_search_empty').text('Error en la búsqueda.').show();
                                    }
                                });
                            }, 400); // debounce 400ms
                        });
                    });
                    </script>

                    <!-- SECTION 3: Recent unassigned customers (online buyers without agent) -->
                    <div class="nk-block-head nk-block-head-sm" style="margin-top:30px;">
                        <div class="nk-block-between">
                            <div class="nk-block-head-content">
                                <h5 class="nk-block-title">📞 Clientes recientes sin agente</h5>
                                <p class="text-soft" style="font-size:13px;">Clientes que compraron en línea sin agente asignado. Asígnalos a ti para darles seguimiento y ofrecerles más productos.</p>
                            </div>
                            <div class="nk-block-head-content">
                                <button class="btn btn-sm btn-outline-primary" id="sk_load_unassigned" style="white-space:nowrap;">
                                    <em class="icon ni ni-reload"></em> Cargar clientes
                                </button>
                            </div>
                        </div>
                    </div>
                    <div id="sk_unassigned_container" style="display:none;">
                        <table class="nk-tb-list is-separate mb-3" style="width:100%;">
                            <thead>
                                <tr class="nk-tb-item nk-tb-head">
                                    <th class="nk-tb-col"><span class="sub-text">Cliente</span></th>
                                    <th class="nk-tb-col tb-col-md"><span class="sub-text">Teléfono</span></th>
                                    <th class="nk-tb-col tb-col-md"><span class="sub-text">Pedidos</span></th>
                                    <th class="nk-tb-col tb-col-md"><span class="sub-text">Total gastado</span></th>
                                    <th class="nk-tb-col tb-col-lg"><span class="sub-text">Último pedido</span></th>
                                    <th class="nk-tb-col"><span class="sub-text">Acciones</span></th>
                                </tr>
                            </thead>
                            <tbody id="sk_unassigned_body"></tbody>
                        </table>
                        <div style="text-align:center;margin-bottom:20px;">
                            <button class="btn btn-sm btn-outline-secondary" id="sk_unassigned_more" style="display:none;">
                                <em class="icon ni ni-plus"></em> Ver más clientes
                            </button>
                        </div>
                    </div>
                    <div id="sk_unassigned_loading" style="display:none;padding:12px;">
                        <span class="spinner-border spinner-border-sm" role="status"></span> Cargando clientes sin agente...
                    </div>
                    <div id="sk_unassigned_empty" style="display:none;padding:12px;color:#999;font-size:13px;">
                        No hay clientes sin agente con pedidos recientes.
                    </div>

                    <script>
                    jQuery(document).ready(function($){
                        var unassignedPage = 1;

                        function loadUnassigned(page) {
                            $('#sk_unassigned_loading').show();
                            $('#sk_unassigned_empty').hide();
                            if (page === 1) {
                                $('#sk_unassigned_body').html('');
                                $('#sk_unassigned_container').hide();
                            }
                            $.ajax({
                                url: '<?php echo admin_url("admin-ajax.php"); ?>',
                                type: 'POST',
                                data: {
                                    action: 'salesking_get_unassigned_customers',
                                    security: '<?php echo wp_create_nonce("salesking_security_nonce"); ?>',
                                    page: page
                                },
                                success: function(resp) {
                                    $('#sk_unassigned_loading').hide();
                                    if (resp.success && resp.data.customers.length > 0) {
                                        var html = '';
                                        resp.data.customers.forEach(function(c) {
                                            var dateStr = '';
                                            if (c.last_order_date) {
                                                var d = new Date(c.last_order_date);
                                                dateStr = d.toLocaleDateString('es-MX', {day:'numeric', month:'short', year:'numeric'});
                                            }
                                            html += '<tr class="nk-tb-item" id="sk_unassigned_row_' + c.id + '">';
                                            html += '<td class="nk-tb-col"><div class="user-card"><div class="user-avatar bg-dim-primary" style="width:32px;height:32px;font-size:12px;"><span>' + c.name.substring(0,2) + '</span></div><div class="user-info"><span class="tb-lead">' + c.name + '</span>';
                                            if (c.company) html += '<br><small class="text-soft">' + c.company + '</small>';
                                            if (c.city) html += '<small class="text-soft"> · ' + c.city + '</small>';
                                            html += '</div></div></td>';
                                            html += '<td class="nk-tb-col tb-col-md"><span>' + (c.phone || '<span class="text-soft">-</span>') + '</span></td>';
                                            html += '<td class="nk-tb-col tb-col-md"><span class="badge badge-dim badge-primary" style="padding:4px 8px;">' + c.order_count + '</span></td>';
                                            html += '<td class="nk-tb-col tb-col-md"><span class="tb-amount">' + formatPrice(c.total_spent) + '</span></td>';
                                            html += '<td class="nk-tb-col tb-col-lg"><span>' + dateStr + '</span></td>';
                                            html += '<td class="nk-tb-col">';
                                            html += '<button class="btn btn-sm btn-success sk_claim_unassigned" data-id="' + c.id + '" data-name="' + c.name + '"><em class="icon ni ni-user-add"></em> Asignar a mí</button>';
                                            html += '</td></tr>';
                                        });
                                        $('#sk_unassigned_body').append(html);
                                        $('#sk_unassigned_container').show();
                                        unassignedPage = resp.data.page;

                                        if (resp.data.has_more) {
                                            $('#sk_unassigned_more').show();
                                        } else {
                                            $('#sk_unassigned_more').hide();
                                        }
                                    } else if (page === 1) {
                                        $('#sk_unassigned_container').hide();
                                        $('#sk_unassigned_empty').show();
                                    } else {
                                        $('#sk_unassigned_more').hide();
                                    }
                                },
                                error: function() {
                                    $('#sk_unassigned_loading').hide();
                                    $('#sk_unassigned_empty').text('Error al cargar clientes.').show();
                                }
                            });
                        }

                        function formatPrice(amount) {
                            return '$' + parseFloat(amount).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
                        }

                        // Load button
                        $('#sk_load_unassigned').on('click', function() {
                            unassignedPage = 1;
                            loadUnassigned(1);
                            $(this).html('<em class="icon ni ni-reload"></em> Recargar');
                        });

                        // Load more button
                        $('#sk_unassigned_more').on('click', function() {
                            loadUnassigned(unassignedPage + 1);
                        });

                        // Claim unassigned customer
                        $(document).on('click', '.sk_claim_unassigned', function() {
                            var btn = $(this);
                            var customerId = btn.data('id');
                            var customerName = btn.data('name');
                            if (!confirm('¿Asignar a "' + customerName + '" como tu cliente?')) return;

                            btn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm"></span>');
                            $.ajax({
                                url: '<?php echo admin_url("admin-ajax.php"); ?>',
                                type: 'POST',
                                data: {
                                    action: 'salesking_claim_customer',
                                    security: '<?php echo wp_create_nonce("salesking_security_nonce"); ?>',
                                    customer_id: customerId
                                },
                                success: function(resp) {
                                    if (resp.success) {
                                        btn.closest('tr').find('.btn').replaceWith('<span class="badge badge-success" style="background:#1ee0ac;padding:4px 10px;">✓ Asignado</span>');
                                        // Fade out after 2 seconds
                                        setTimeout(function() {
                                            $('#sk_unassigned_row_' + customerId).fadeOut(400, function(){ $(this).remove(); });
                                        }, 2000);
                                    } else {
                                        alert(resp.data || 'Error al asignar.');
                                        btn.prop('disabled', false).html('<em class="icon ni ni-user-add"></em> Asignar a mí');
                                    }
                                },
                                error: function() {
                                    alert('Error de conexión.');
                                    btn.prop('disabled', false).html('<em class="icon ni ni-user-add"></em> Asignar a mí');
                                }
                            });
                        });
                    });
                    </script>

                </div>
            </div>
        </div>
        <div class="modal fade" tabindex="-1" id="modal_add_customer">
            <div class="modal-dialog" role="document">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title"><?php esc_html_e('Customer Info','salesking'); ?></h5>
                        <a href="#" class="close" data-dismiss="modal" aria-label="Close">
                            <em class="icon ni ni-cross"></em>
                        </a>
                    </div>
                    <div class="modal-body">
                        <form action="#" class="form-validate is-alter" id="salesking_add_customer_form">
                            <?php
                            if (apply_filters('salesking_add_customer_show_first_last_name', true)){
                                ?>
                                <div class="form-group">
                                    <label class="form-label" for="first-name"><?php esc_html_e('First name','salesking'); ?> <span class="required">*</span></label>
                                    <div class="form-control-wrap">
                                        <input type="text" class="form-control" id="first-name" name="first-name" required>
                                    </div>
                                </div>
                                <div class="form-group">
                                    <label class="form-label" for="last-name"><?php esc_html_e('Last name','salesking'); ?> <span class="required">*</span></label>
                                    <div class="form-control-wrap">
                                        <input type="text" class="form-control" id="last-name" name="last-name" required>
                                    </div>
                                </div>
                                <?php
                            }
                            ?>
                            <div class="form-group">
                                <label class="form-label" for="company-name"><?php esc_html_e('Company name','salesking'); ?></label>
                                <div class="form-control-wrap">
                                    <input type="text" class="form-control" id="company-name" name="company-name">
                                </div>
                            </div>
                            <div class="form-group">
                                <label class="form-label" for="billing_country"><?php esc_html_e('Country','salesking'); ?></label>
                                <div class="form-control-wrap">
                                    <style>
                                        p#billing_country_field {
                                            display: block !important;
                                            margin: 10px 0px;
                                            margin-top: 0px !important;
                                        }
                                    </style>
                                    <?php

                                    // Alternative approach with direct AJAX handling
                                    woocommerce_form_field( 'billing_country', array(
                                        'type' => 'country',
                                        'input_class' => array('form-control'),
                                        'required' => true,
                                        'custom_attributes' => array('data-target' => 'billing_state')
                                    ));

                                    if (apply_filters('salesking_show_add_customer_state', true)){
                                        woocommerce_form_field( 'billing_state', array(
                                            'type' => 'state',
                                            'input_class' => array('form-control'),
                                            'required' => true,
                                            'country_field' => 'billing_country'
                                        ));
                                    }

                                    

                                    ?>
                                </div>

                                <script type="text/javascript">
                                    jQuery(document).ready(function($) {
                                        // Function to update states based on country
                                        function updateStates(countryCode, $stateField) {
                                            // Get WooCommerce countries object
                                            if (typeof salesking_display_settings.country_params !== 'undefined') {
                                                var states = salesking_display_settings.country_params.countries[countryCode];
                                                
                                                // Clear current options
                                                $stateField.empty();
                                                
                                                if (states) {
                                                    // Add default option
                                                    $stateField.append('<option value="">' + salesking_display_settings.country_params.i18n_select_state_text + '</option>');
                                                    
                                                    // Add state options
                                                    $.each(states, function(code, name) {
                                                        $stateField.append('<option value="' + code + '">' + name + '</option>');
                                                    });
                                                    
                                                    // Show state field
                                                    $stateField.closest('.form-row').show();
                                                } else {
                                                    // Hide state field if no states
                                                    $stateField.closest('.form-row').hide();
                                                }
                                                
                                                // Trigger change event
                                                $stateField.trigger('change');
                                            }
                                        }
                                        
                                        // Handle country change
                                        $(document).on('change', '#billing_country', function() {
                                            var countryCode = $(this).val();
                                            var $stateField = $('#billing_state');
                                            
                                            updateStates(countryCode, $stateField);
                                        });
                                        
                                        // Initialize on page load
                                        var initialCountry = $('#billing_country').val();
                                        if (initialCountry) {
                                            updateStates(initialCountry, $('#billing_state'));
                                        }
                                    });
                                    </script>
                            </div>

                            <?php

                            if (apply_filters('salesking_add_customer_after_country_state', false)){
                                add_action('salesking_add_customer_after_country',function(){
                                    ?>
                                    <div class="form-group">
                                        <label class="form-label" for="billing_state"><?php esc_html_e('State','salesking'); ?></label>
                                        <div class="form-control-wrap">
                                            <input type="text" class="form-control" id="billing_state" name="billing_state">
                                        </div>
                                    </div>
                                    <?php
                                });
                            }
                           

                            do_action('salesking_add_customer_after_country'); ?>

                            <div class="form-group">
                                <label class="form-label" for="street-address"><?php esc_html_e('Street address','salesking'); ?></label>
                                <div class="form-control-wrap">
                                    <input type="text" class="form-control" id="street-address" name="street-address">
                                </div>
                            </div>
                            <?php do_action('salesking_add_customer_after_street'); ?>
                            <div class="form-group">
                                <label class="form-label" for="street-address2"><?php esc_html_e('Colonia','salesking'); ?></label>
                                <div class="form-control-wrap">
                                    <input type="text" class="form-control" id="street-address2" name="street-address2">
                                </div>
                            </div>
                            <div class="form-group">
                                <label class="form-label" for="town-city"><?php esc_html_e('Town / City','salesking'); ?></label>
                                <div class="form-control-wrap">
                                    <input type="text" class="form-control" id="town-city" name="town-city">
                                </div>
                            </div>
                            <?php do_action('salesking_add_customer_after_city'); ?>
                            <div class="form-group">
                                <label class="form-label" for="postcode-zip"><?php esc_html_e('Postcode / ZIP','salesking'); ?></label>
                                <div class="form-control-wrap">
                                    <input type="text" class="form-control" id="postcode-zip" name="postcode-zip">
                                </div>
                            </div>
                            <div class="form-group">
                                <label class="form-label" for="phone-no"><?php esc_html_e('Phone No','salesking'); ?></label>
                                <div class="form-control-wrap">
                                    <input type="text" class="form-control" id="phone-no" name="phone-no">
                                </div>
                            </div>
                            <?php
                            // b2bking custom fields (optional)
                            if (defined('B2BKING_DIR') && apply_filters('salesking_show_b2bking_fields_customer', true)){
                                // add editable fields
                                $custom_fields_editable = get_posts([
                                                'post_type' => 'b2bking_custom_field',
                                                'post_status' => 'publish',
                                                'numberposts' => -1,
                                                'orderby' => 'menu_order',
                                                'order' => 'ASC',
                                                'fields' => 'ids',
                                                'meta_query'=> array(
                                                    'relation' => 'AND',
                                                    array(
                                                        'key' => 'b2bking_custom_field_status',
                                                        'value' => 1
                                                    ),
                                                )
                                            ]);

                                $custom_fields_editable = apply_filters('salesking_b2bking_custom_fields', $custom_fields_editable);

                                $custom_fields = '';
                                $custom_fields_array_exploded = array();

                                
                                foreach ($custom_fields_editable as $editable_field){
                                    if (!in_array($editable_field, $custom_fields_array_exploded)){

                                        // don't show files
                                        $afield_type = get_post_meta($editable_field, 'b2bking_custom_field_field_type', true);
                                        $afield_billing_connection = get_post_meta($editable_field, 'b2bking_custom_field_billing_connection', true);
                                        if ($afield_type === 'file'){
                                            continue;
                                        }
                                        if ($afield_type === 'checkbox'){
                                            continue;
                                        }
                                        if ($afield_billing_connection !== 'billing_vat' && $afield_billing_connection !== 'none' && $afield_billing_connection !== 'custom_mapping' && !in_array($editable_field, apply_filters('salesking_b2bking_custom_fields', array() ) ) ) {
                                            continue;
                                        }

                                        array_push($custom_fields_array_exploded,$editable_field);
                                        $custom_fields.=$editable_field.',';
                                    }
                                }
                                $custom_fields = substr($custom_fields, 0, -1);
                                foreach ($custom_fields_array_exploded as $field_id){
                                    $field_type = get_post_meta($field_id, 'b2bking_custom_field_field_type', true);
                                    $label = get_post_meta($field_id, 'b2bking_custom_field_field_label', true);

                                    if ($field_type === 'select'){
                                        $select_options = get_post_meta(apply_filters( 'wpml_object_id', $field_id, 'post', true ), 'b2bking_custom_field_user_choices', true);
                                        $select_options = explode(',', $select_options);

                                        ?>
                                        <div class="form-group">
                                            <label class="form-label" for="salesking_field_<?php echo esc_attr($field_id);?>"><?php echo esc_html($label);?></label>
                                            <div class="form-control-wrap">
                                        <?php
                                        echo '<select id="salesking_field_'.esc_attr($field_id).'" class="form-control" name="salesking_field_'.esc_attr($field_id).'">';
                                            foreach ($select_options as $option){
                                                // check if option is simple or value is specified via option:value
                                                $optionvalue = explode(':', $option);
                                                if (count($optionvalue) === 2 ){
                                                    // value is specified
                                                    echo '<option value="'.esc_attr(trim($optionvalue[0])).'" '.selected(trim($optionvalue[0]), '', false).'>'.esc_html(trim($optionvalue[1])).'</option>';
                                                } else {
                                                    // simple
                                                    echo '<option value="'.esc_attr(trim($option)).'" '.selected($option, '', false).'>'.esc_html(trim($option)).'</option>';
                                                }
                                            }
                                        echo '</select></div></div>';
                                    } else {
                                        ?>
                                        <div class="form-group">
                                            <label class="form-label" for="salesking_field_<?php echo esc_attr($field_id);?>"><?php echo esc_html($label);?></label>
                                            <div class="form-control-wrap">
                                                <input type="text" class="form-control" id="salesking_field_<?php echo esc_attr($field_id);?>" name="salesking_field_<?php echo esc_attr($field_id);?>">
                                            </div>
                                        </div>
                                        <?php
                                    }
                                    

                                }

                                // show group optionally
                                if (apply_filters('salesking_show_b2bking_groups_new_customer',true)){
                                    $groups = get_posts( array( 'post_type' => 'b2bking_group','post_status'=>'publish','numberposts' => -1) );
                                    
                                    ?>
                                    <div class="form-group">
                                        <label class="form-label" for="salesking_b2bking_group"><?php esc_html_e('B2B Group','salesking');?></label>
                                        <div class="form-control-wrap">
                                            <select id="salesking_b2bking_group" name="salesking_b2bking_group" class="form-control">
                                                <?php
                                                if ( get_option( 'b2bking_plugin_status_setting', 'b2b' ) !== 'b2b' && apply_filters('b2bking_b2b_shop_hide_b2c_option', true) ){
                                                    ?>
                                                    <option value="b2c"><?php esc_html_e('B2C Users','salesking');?></option>
                                                    <?php
                                                }
                                                foreach ($groups as $group){

                                                    echo '<option value="' . $group->ID . '">' . get_the_title($group) . '</option>';
                                                }
                                                ?>
                                                
                                            </select>
                                        </div>
                                    </div>
                                    <?php
                                }
                                echo '<input type="hidden" id="salesking_b2bking_custom_fields" value="'.esc_attr($custom_fields).'">';

                            }

                            // B2b & Wholesalesuite custom fields
                            // b2bking custom fields (optional)
                            if (defined('B2BWHS_DIR') && apply_filters('salesking_show_b2bwhs_fields_customer', true)){
                                // add editable fields
                                $custom_fields_editable = get_posts([
                                                'post_type' => 'b2bwhs_custom_field',
                                                'post_status' => 'publish',
                                                'numberposts' => -1,
                                                'meta_key' => 'b2bwhs_custom_field_sort_number',
                                                'orderby' => 'meta_value_num',
                                                'order' => 'ASC',
                                                'fields' => 'ids',
                                                'meta_query'=> array(
                                                    'relation' => 'AND',
                                                    array(
                                                        'key' => 'b2bwhs_custom_field_status',
                                                        'value' => 1
                                                    ),
                                                )
                                            ]);
                                $custom_fields = '';
                                $custom_fields_array_exploded = array();

                                
                                foreach ($custom_fields_editable as $editable_field){
                                    if (!in_array($editable_field, $custom_fields_array_exploded)){

                                        // don't show files
                                        $afield_type = get_post_meta($editable_field, 'b2bwhs_custom_field_field_type', true);
                                        $afield_billing_connection = get_post_meta($editable_field, 'b2bwhs_custom_field_billing_connection', true);
                                        if ($afield_type === 'file'){
                                            continue;
                                        }
                                        if ($afield_type === 'checkbox'){
                                            continue;
                                        }
                                        if ($afield_billing_connection !== 'billing_vat' && $afield_billing_connection !== 'none' && $afield_billing_connection !== 'custom_mapping'){
                                            continue;
                                        }

                                        array_push($custom_fields_array_exploded,$editable_field);
                                        $custom_fields.=$editable_field.',';
                                    }
                                }
                                $custom_fields = substr($custom_fields, 0, -1);
                                foreach ($custom_fields_array_exploded as $field_id){
                                    $label = get_post_meta($field_id, 'b2bwhs_custom_field_field_label', true);
                                    ?>
                                    <div class="form-group">
                                        <label class="form-label" for="salesking_field_<?php echo esc_attr($field_id);?>"><?php echo esc_html($label);?></label>
                                        <div class="form-control-wrap">
                                            <input type="text" class="form-control" id="salesking_field_<?php echo esc_attr($field_id);?>" name="salesking_field_<?php echo esc_attr($field_id);?>">
                                        </div>
                                    </div>

                                    <?php
                                }

                                // show group optionally
                                if (apply_filters('salesking_show_b2bwhs_groups_new_customer',true)){
                                    $groups = get_posts( array( 'post_type' => 'b2bwhs_group','post_status'=>'publish','numberposts' => -1) );
                                    
                                    ?>
                                    <div class="form-group">
                                        <label class="form-label" for="salesking_b2bwhs_group"><?php esc_html_e('B2B Group','salesking');?></label>
                                        <div class="form-control-wrap">
                                            <select id="salesking_b2bwhs_group" name="salesking_b2bwhs_group" class="form-control">
                                                <option value="b2c"><?php esc_html_e('B2C Users','salesking');?></option>
                                                <?php
                                                foreach ($groups as $group){

                                                    echo '<option value="' . $group->ID . '">' . get_the_title($group) . '</option>';
                                                }
                                                ?>
                                                
                                            </select>
                                        </div>
                                    </div>
                                    <?php
                                }
                                echo '<input type="hidden" id="salesking_b2bwhs_custom_fields" value="'.esc_attr($custom_fields).'">';

                            }

                            do_action('salesking_add_customer_custom_fields');
                            $custom_fields_code = apply_filters('salesking_custom_fields_code_list_comma',''); // comma separated list

                            echo '<input type="hidden" id="salesking_custom_fields_code" value="'.esc_attr($custom_fields_code).'">';

                            ?>
                            <div class="form-group">
                                <label class="form-label" for="username"><?php esc_html_e('Username','salesking'); ?> <span class="required">*</span></label>
                                <div class="form-control-wrap">
                                    <input type="text" class="form-control" id="username" name="username" required>
                                </div>
                            </div>
                            <div class="form-group">
                                <label class="form-label" for="email-address"><?php esc_html_e('Email address','salesking'); ?> <span class="required">*</span></label>
                                <div class="form-control-wrap">
                                    <input type="email" class="form-control" id="email-address" name="email-address" required>
                                </div>
                            </div>
                            <div class="form-group">
                                <div class="form-control-wrap">
                                    <input type="hidden" id="password" name="password" value="">
                                    <div class="alert alert-info" style="margin:0; padding:10px 15px; background:#e8f4fd; border:1px solid #bee5eb; border-radius:4px; color:#0c5460; font-size:13px;">
                                        <strong>Contraseña automática</strong> — Se enviará un correo al cliente con un enlace para establecer su contraseña.
                                    </div>
                                </div>
                            </div>

                            <div class="form-group">
                                <button type="button" id="salesking_add_customer" class="btn btn-lg btn-primary"><?php esc_html_e('Add Customer','salesking'); ?></button>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer bg-light">
                    </div>
                </div>
            </div>
        </div>
    </div>
    <?php
}
?>