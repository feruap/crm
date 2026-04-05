<?php
if (intval(get_option( 'salesking_enable_coupons_setting', 1 )) === 1){

    // get max allowed discount
    $allowed_discount = get_user_meta($user_id, 'salesking_group_max_discount', true);
    if (empty($allowed_discount) || !($allowed_discount)){
        $group_discount = get_post_meta($agent_group,'salesking_group_max_discount', true);
        $allowed_discount = $group_discount;
    }
    if (empty($allowed_discount) || !($allowed_discount)){
        $allowed_discount = 1;
    }

    
    ?>
    <div class="nk-content salesking_coupons_page">
        <div class="container-fluid">
            <div class="nk-content-inner">
                <div class="nk-content-body">
                    <div class="components-preDelete wide-md mx-auto">
                        <div class="nk-block-head nk-block-head-sm">
                            <div class="nk-block-between">
                                <div class="nk-block-head-content">
                                    <h3 class="nk-block-title page-title"><?php esc_html_e('Discount Coupons','salesking');?></h3>
                                    <div class="nk-block-des text-soft">
                                        <p><?php esc_html_e('Create and share coupons, and earn a commission each time your coupon codes are used!','salesking');?></p>
                                    </div>
                                </div><!-- .nk-block-head-content -->
                               
                            </div><!-- .nk-block-between -->
                        </div><!-- .nk-block-head -->
                        <div class="nk-block">
                            <div class="row g-gs">
                                <div class="col-xxl-12 col-sm-12">
                                    <div class="card is-dark text-white">
                                        <div class="card-inner">
                                            <div class="card-head">
                                                <h5 class="card-title"><?php esc_html_e('Create a coupon','salesking');?></h5>
                                            </div>
                                            <form action="#" id="salesking_coupon_submit_form">
                                                <div class="row g-4">
                                                    <div class="col-lg-6">
                                                        <div class="form-group">
                                                            <label class="form-label text-white" data-toggle="tooltip" data-placement="right" title="<?php esc_attr_e('How many times this coupon can be used before it is void.','salesking');?>"><?php esc_html_e('Usage Limit','salesking');?></label>
                                                            <div class="form-control-wrap number-spinner-wrap">
                                                                <button type="button" class="btn btn-icon btn-outline-light number-spinner-btn number-minus" data-number="minus"><em class="icon ni ni-minus"></em></button>
                                                                <input type="number" class="form-control number-spinner" value="1" min="1"  id="salesking_limit_input">
                                                                <button type="button" class="btn btn-icon btn-outline-light number-spinner-btn number-plus" data-number="plus"><em class="icon ni ni-plus"></em></button>
                                                            </div>
                                                        </div>
                                                        
                                                    </div>
                                                    <div class="col-lg-6">
                                                        <div class="form-group">
                                                            <label class="form-label text-white" data-toggle="tooltip" data-placement="right" title="<?php esc_attr_e('Discount percentage that the customer benefits from.','salesking');?>"><?php esc_html_e('Discount Percentage (%)','salesking');?></label>
                                                            <div class="form-control-wrap number-spinner-wrap">
                                                                <button type="button" class="btn btn-icon btn-outline-light number-spinner-btn number-minus" data-number="minus"><em class="icon ni ni-minus"></em></button>
                                                                <input type="number" class="form-control number-spinner" value="1" min="0" max="<?php echo esc_attr($allowed_discount);?>" id="salesking_discount_input">
                                                                <button type="button" class="btn btn-icon btn-outline-light number-spinner-btn number-plus" data-number="plus"><em class="icon ni ni-plus"></em></button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div class="col-lg-6">
                                                        <div class="form-group">
                                                            <label class="form-label text-white" data-toggle="tooltip" data-placement="right" title="<?php esc_attr_e('This field allows you to set the minimum spend (subtotal) allowed to use the coupon.','salesking');?>"><?php esc_html_e('Minimum Spend (optional)','salesking');?></label>
                                                            <div class="form-control-wrap number-spinner-wrap">
                                                                <button type="button" class="btn btn-icon btn-outline-light number-spinner-btn number-minus" data-number="minus"><em class="icon ni ni-minus"></em></button>
                                                                <input type="number" class="form-control number-spinner" id="salesking_minimum_spend_input">
                                                                <button type="button" class="btn btn-icon btn-outline-light number-spinner-btn number-plus" data-number="plus"><em class="icon ni ni-plus"></em></button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div class="col-lg-6">
                                                        <div class="form-group">
                                                            <label class="form-label text-white" data-toggle="tooltip" data-placement="right" title="<?php esc_attr_e('This field allows you to set the maximum spend (subtotal) allowed to use the coupon.','salesking');?>"><?php esc_html_e('Maximum Spend (optional)','salesking');?></label>
                                                            <div class="form-control-wrap number-spinner-wrap">
                                                                <button type="button" class="btn btn-icon btn-outline-light number-spinner-btn number-minus" data-number="minus"><em class="icon ni ni-minus"></em></button>
                                                                <input type="number" class="form-control number-spinner" id="salesking_maximum_spend_input">
                                                                <button type="button" class="btn btn-icon btn-outline-light number-spinner-btn number-plus" data-number="plus"><em class="icon ni ni-plus"></em></button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div class="col-lg-6">
                                                        <div class="form-group">
                                                            <label class="form-label text-white" for="salesking_coupon_code_input" data-toggle="tooltip" data-placement="right" title="<?php esc_attr_e('If the desired coupon code already exists, a close alternative will be used.','salesking');?>"><?php esc_html_e('Coupon Code','salesking');?></label>
                                                            <div class="form-control-wrap">
                                                                <input type="text" class="form-control" id="salesking_coupon_code_input" required>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div class="col-lg-6">
                                                        <div class="form-group">
                                                            <label class="form-label text-white" data-toggle="tooltip" data-placement="right" title="<?php esc_attr_e('The coupon will expire at 00:00 of this date.','salesking');?>"><?php esc_html_e('Coupon Expiry Date (optional)','salesking');?></label>
                                                            <div class="form-control-wrap">
                                                                <div class="form-icon form-icon-left">
                                                                    <em class="icon ni ni-calendar"></em>
                                                                </div>
                                                                <input type="text" class="form-control date-picker" data-date-format="yyyy-mm-dd" id="salesking_expiry_date_input">
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div class="col-lg-6">
                                                        <div class="form-group">
                                                           <button type="button" class="btn btn-lg btn-lighter" id="salesking_dashboard_save_coupon"><?php esc_html_e('Save Coupon','salesking');?></button>
                                                       </div>
                                                    </div>
                                                    <div class="col-lg-6">
                                                        <div class="form-group">
                                                            <div class="salesking_custom_switches_container">
                                                                <div class="custom-control custom-switch align-center">
                                                                    <input type="checkbox" class="custom-control-input" id="salesking_exclude_sales_items">
                                                                    <label class="custom-control-label" for="salesking_exclude_sales_items" data-toggle="tooltip" data-placement="right" title="<?php esc_attr_e('Check this box if the coupon should not apply to items on sale. Coupons will only work if there are items in the cart that are not on sale.','salesking');?>"><?php esc_html_e('Exclude Sale Items','salesking');?></label>
                                                                </div><br>
                                                                <div class="custom-control custom-switch align-center">
                                                                    <input type="checkbox" class="custom-control-input" id="salesking_allow_free_shipping">
                                                                    <label class="custom-control-label" for="salesking_allow_free_shipping" data-toggle="tooltip" data-placement="right" title="<?php esc_attr_e('Check this box if the coupon grants free shipping.','salesking');?>"><?php esc_html_e('Allow Free Shipping','salesking');?></label>
                                                                </div>
                                                            </div>
                                                        </div>

                                                    </div>
                                                   
                                                </div>
                                            </form>
                                        </div>

                                        <div class="card-footer border-top text-white bg-gray"><?php esc_html_e('Maximum allowed discount:','salesking');?> <strong><?php echo esc_html($allowed_discount);?>%</strong></div>
                                    </div>
                                </div><!-- .col -->

                                <?php
                                // get all agent coupons
                                $agent_coupons = get_posts(
                                    array( 
                                        'post_type' => 'shop_coupon', // only conversations
                                        'post_status' => 'publish',
                                        'numberposts' => -1,
                                        'fields' => 'ids',
                                        'meta_query'=> array(   // only the specific user's conversations
                                            'relation' => 'OR',
                                            array(
                                                'key' => 'salesking_agent',
                                                'value' => get_current_user_id(), 
                                            ),
                                        )
                                    )
                                );

                                if (!empty($agent_coupons)){
                                ?>
                                    <div class="col-xxl-12 mt-3">
                                        <div class="card">
                                            <table class="table table-tranx">
                                                <thead>
                                                    <tr class="tb-tnx-head">
                                                        <th class="tb-tnx-id"><span class=""><?php esc_html_e('Coupon Code','salesking');?></span></th>
                                                        <th class="tb-tnx-info">
                                                            <span class="tb-tnx-desc d-none d-sm-inline-block">
                                                                <span><?php esc_html_e('Discount','salesking');?></span>
                                                            </span>
                                                            <span class="tb-tnx-date d-md-inline-block d-none">
                                                                <span class="d-none d-md-block">
                                                                    <span><?php esc_html_e('Min Spend','salesking');?></span>
                                                                    <span><?php esc_html_e('Max Spend','salesking');?></span>

                                                                </span>
                                                            </span>
                                                        </th>
                                                        <th class="tb-tnx-amount is-alt d-none">
                                                            <span class="tb-tnx-total"><?php esc_html_e('Expiry Date','salesking');?></span>
                                                            <span class="tb-tnx-status d-none d-md-inline-block"><?php esc_html_e('Uses Left','salesking');?></span>
                                                        </th>
                                                        <th class="tb-tnx-action">
                                                            <span>&nbsp;</span>
                                                        </th>
                                                        <th class="tb-tnx-action">
                                                            <span>&nbsp;</span>
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    <?php
                                                    

                                                    foreach ($agent_coupons as $coupon_id){
                                                        $coupon = new WC_Coupon($coupon_id);
                                                        $usage = ($coupon->get_usage_limit()-$coupon->get_usage_count());
                                                        if ($usage > 0){
                                                            $badge = 'badge-success';
                                                        } else {
                                                            $badge = 'badge-danger';
                                                        }
                                                        ?>
                                                        <tr class="tb-tnx-item">
                                                            <td class="tb-tnx-id"><span class="text-primary">
                                                                <?php echo strtoupper(esc_html($coupon->get_code())); ?></span>
                                                            </td>
                                                            <td class="tb-tnx-info">
                                                                <div class="tb-tnx-desc">
                                                                    <span class="title"><?php echo esc_html($coupon->get_amount()); ?>%<?php

                                                                    ?></span>
                                                                </div>
                                                                <div class="tb-tnx-date">
                                                                    <span class="date"><?php 
                                                                    $amount = $coupon->get_minimum_amount();
                                                                    if (!empty($amount)){
                                                                        echo wc_price(esc_html($amount)); 
                                                                    }
                                                                    ?></span>
                                                                    <span class="date"><?php 
                                                                    $amount = $coupon->get_maximum_amount();
                                                                    if (!empty($amount)){
                                                                        echo wc_price(esc_html($amount)); 
                                                                    }
                                                                    ?></span>
                                                                </div>
                                                            </td>
                                                            <td class="tb-tnx-amount is-alt ">
                                                                <div class="tb-tnx-total d-none">
                                                                    <span class="amount"><?php 
                                                                    if ($coupon){
                                                                        if ($coupon->get_date_expires()){
                                                                            echo esc_html(explode('T',$coupon->get_date_expires())[0]); 
                                                                        }
                                                                    }

                                                                ?></span>
                                                                </div>
                                                                <div class="tb-tnx-status"><span class="badge badge-dot <?php echo esc_attr($badge);?>"><?php echo esc_html($usage); ?> <?php esc_html_e('uses left','salesking');


                                                                    // show free shipping / exclude sale item
                                                                    if ($coupon->get_free_shipping()){
                                                                        echo ' - '.esc_html__('free shipping','salesking');
                                                                    }
                                                                    if ($coupon->get_exclude_sale_items()){
                                                                        echo ' - '.esc_html__('exc. sale items','salesking');

                                                                    }
                                                            ?></span></div>
                                                            </td>
                                                            <td class="tb-tnx-action">
                                                                <div class="tb-odr-btns d-none d-md-inline">
                                                                    <button class="btn btn-sm btn-primary salesking_delete_coupon" value="<?php echo esc_attr($coupon_id);?>"><?php esc_html_e('Delete','salesking');?></button>
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
                                    <?php
                                    } else {
                                        ?>
                                        <div class="col-lg-12">
                                            <div class="example-alert">
                                                <div class="alert alert-fill alert-light alert-icon">
                                                    <em class="icon ni ni-help"></em> <?php esc_html_e('You don\'t have any coupons yet. Create your first coupon.','salesking');?> </div>
                                            </div>
                                        </div>
                                        <?php
                                    }
                                ?>
                            </div>
                        </div><!-- .row -->
                    </div><!-- .nk-block -->
                </div>
            </div>
        </div>
    </div>
    <?php
}
?>