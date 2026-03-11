<?php
if (intval(get_option( 'salesking_enable_teams_setting', 1 )) === 1){
    ?>
    <div class="nk-content salesking_teams_page">
        <div class="container-fluid">
            <div class="nk-content-inner">
                <div class="nk-content-body">
                    <div class="nk-block-head nk-block-head-sm">
                        <div class="nk-block-between">
                            <div class="nk-block-head-content">
                                <h3 class="nk-block-title page-title"><?php esc_html_e('My Team - Subagents','salesking');?></h3>
                                <div class="nk-block-des text-soft">
                                    <p><?php esc_html_e('Here you can create subagent accounts that will be part of your team. You receive commissions based on their earnings', 'salesking');?></p>
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
                                                    <input type="text" class="form-control" id="salesking_teams_search" placeholder="<?php esc_html_e('Search subagents...','salesking');?>">
                                                </div>
                                            </li>
                                            <?php
                                            if (apply_filters('salesking_default_add_subagent', true)){
                                                if (apply_filters('salesking_allow_agents_add_subagents', true)){
                                                    if (apply_filters('salesking_allow_agent_add_subagents', true, get_current_user_id())){
                                                        ?>
                                                        <li class="nk-block-tools-opt">
                                                            <a href="#" class="btn btn-icon btn-primary d-md-none" data-toggle="modal" data-target="#modal_add_subagent"><em class="icon ni ni-plus"></em></a>
                                                            <button class="btn btn-primary d-none d-md-inline-flex" data-toggle="modal" data-target="#modal_add_subagent"><em class="icon ni ni-plus"></em><span><?php esc_html_e('Add','salesking');?></span></button>
                                                        </li>
                                                        <?php
                                                    }
                                                }
                                            } else {
                                                do_action('salesking_alternative_add_subagent');
                                            }
                                            ?>
                                        </ul>
                                    </div>
                                </div>
                            </div><!-- .nk-block-head-content -->
                        </div><!-- .nk-block-between -->
                    </div><!-- .nk-block-head -->
                    <table id="salesking_dashboard_teams_table" class="nk-tb-list is-separate mb-3">
                        <thead>
                            <tr class="nk-tb-item nk-tb-head">
                                <th class="nk-tb-col"><span class="sub-text"><?php esc_html_e('Agent','salesking'); ?></span></th>
                                <th class="nk-tb-col tb-col-mb"><span class="sub-text"><?php esc_html_e('Agent Total Earnings','salesking'); ?></span></th>
                                <th class="nk-tb-col tb-col-mb"><span class="sub-text"><?php esc_html_e('Your Total Commission','salesking'); ?></span></th>
                                <th class="nk-tb-col tb-col-mb"><span class="sub-text"><?php esc_html_e('Number of Orders','salesking'); ?></span></th>
                                <th class="nk-tb-col tb-col-md"><span class="sub-text"><?php esc_html_e('Email','salesking'); ?></span></th>
                                <th class="nk-tb-col tb-col-lg"><span class="sub-text"><?php esc_html_e('Phone','salesking'); ?></span></th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php

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
                                      'value' => $user_id,
                                      'compare' => '=',
                                  ),
                              )));


                            foreach ($subagents as $subagent_id){
                                $user_info = get_userdata($subagent_id);

                                if (empty($user_info->first_name) && empty($user_info->last_name)){
                                    $name = $user_info->user_login;
                                } else {
                                    $name = $user_info->first_name.' '.$user_info->last_name;
                                }
                            ?>
                                <tr class="nk-tb-item">
                                        <td class="nk-tb-col">

                                            <div>
                                                <div class="user-card">
                                                    <div class="user-avatar bg-primary">
                                                        <span><?php echo esc_html(substr($name, 0, 2));?></span>
                                                    </div>
                                                    <div class="user-info">
                                                        <span class="tb-lead"><?php echo esc_html(apply_filters('salesking_subagent_name',$name, $subagent_id));?> <span class="dot dot-success d-md-none ml-1"></span></span>
                                                    </div>
                                                </div>
                                            </div>

                                        </td>
                                        <?php
                                        
                                        // get agent total earnings
                                        require_once ( SALESKING_DIR . 'includes/class-salesking-helper.php' );
                                        $helper = new Salesking_Helper();
                                        $total_agent_commissions = $helper->get_agent_earnings($subagent_id);

                                        // get commissions from subagent
                                        $total_subagent_commission = $helper->get_total_subagent_commission($subagent_id);

                                        $args = array(
                                            'limit' => -1,
                                            'type' => 'shop_order',
                                            'meta_key'      => 'salesking_assigned_agent', // Postmeta key field
                                            'meta_value'    => $subagent_id, // Postmeta value field
                                            'meta_compare'  => '=', // P
                                        );
                                        $agent_orders_nr = count(wc_get_orders( $args ));

                                        ?>
                                        <td class="nk-tb-col tb-col-mb" data-order="<?php echo esc_attr($total_agent_commissions);?>">
                                            <div>
                                                <span class="tb-amount"><?php echo wc_price($total_agent_commissions);?></span>
                                            </div>
                                        </td>
                                        <td class="nk-tb-col tb-col-mb" data-order="<?php echo esc_attr($total_subagent_commission);?>">
                                            <div>
                                                <span class="tb-amount"><?php echo wc_price($total_subagent_commission);?></span>
                                            </div>
                                        </td>
                                        <td class="nk-tb-col tb-col-mb">
                                            <div>
                                                <span class="tb-amount"><?php echo $agent_orders_nr;?></span>
                                            </div>
                                        </td>

                                        <td class="nk-tb-col tb-col-lg">
                                            <div>
                                                <span><?php echo esc_html($user_info->user_email);?></span>
                                            </div>
                                        </td>
                                        <td class="nk-tb-col tb-col-md"> 
                                            <div >
                                                <span><?php echo esc_html(get_user_meta($subagent_id,'billing_phone', true));?></span>
                                            </div>
                                        </td>

                                       
                                </tr>
                                <?php
                            }
                            ?>
                            
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        <div class="modal fade" tabindex="-1" id="modal_add_subagent">
            <div class="modal-dialog" role="document">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title"><?php esc_html_e('Subagent Info','salesking'); ?></h5>
                        <a href="#" class="close" data-dismiss="modal" aria-label="Close">
                            <em class="icon ni ni-cross"></em>
                        </a>
                    </div>
                    <div class="modal-body">
                        <form action="#" class="form-validate is-alter" id="salesking_add_subagent_form">
                            <div class="form-group">
                                <label class="form-label" for="first-name"><?php esc_html_e('First name','salesking'); ?></label>
                                <div class="form-control-wrap">
                                    <input type="text" class="form-control" id="first-name" name="first-name" required>
                                </div>
                            </div>
                            <div class="form-group">
                                <label class="form-label" for="last-name"><?php esc_html_e('Last name','salesking'); ?></label>
                                <div class="form-control-wrap">
                                    <input type="text" class="form-control" id="last-name" name="last-name" required>
                                </div>
                            </div>
                            <div class="form-group">
                                <label class="form-label" for="phone-no"><?php esc_html_e('Phone No','salesking'); ?></label>
                                <div class="form-control-wrap">
                                    <input type="text" class="form-control" id="phone-no" name="phone-no">
                                </div>
                            </div>
                            <div class="form-group">
                                <label class="form-label" for="username"><?php esc_html_e('Username','salesking'); ?></label>
                                <div class="form-control-wrap">
                                    <input type="text" class="form-control" id="username" name="username" required>
                                </div>
                            </div>
                            <div class="form-group">
                                <label class="form-label" for="email-address"><?php esc_html_e('Email address','salesking'); ?></label>
                                <div class="form-control-wrap">
                                    <input type="email" class="form-control" id="email-address" name="email-address" required>
                                </div>
                            </div>
                            <div class="form-group">
                                <label class="form-label" for="password"><?php esc_html_e('Password','salesking'); ?></label>
                                <div class="form-control-wrap">
                                    <input type="password" class="form-control" id="password" name="password" required>
                                </div>
                            </div>

                            <div class="form-group">
                                <button type="button" id="salesking_add_subagent" class="btn btn-lg btn-primary"><?php esc_html_e('Add Subagent','salesking'); ?></button>
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