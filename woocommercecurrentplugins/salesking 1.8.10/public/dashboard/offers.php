<?php

    if (intval(get_option( 'salesking_enable_offers_setting', 1 )) !== 1){
        return;
    }
    if (intval(get_option( 'b2bking_enable_offers_setting', 1 )) !== 1){
        return;
    }

    if (intval(apply_filters('salesking_enable_offers_page', 1)) === 1){
    ?>
    <div class="nk-content salesking_offers_page">
        <div class="container-fluid">
            <div class="nk-content-inner">
                <div class="nk-content-body">
                    <div class="nk-block-head nk-block-head-sm">
                        <div class="nk-block-between">
                            <div class="nk-block-head-content">
                                <h3 class="nk-block-title page-title"><?php esc_html_e('Offers','salesking');?></h3>
                                <div class="nk-block-des text-soft">
                                    <p><?php esc_html_e('Create and manage offers for customers.', 'salesking');?><br /></p>
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
                                                    <input type="text" class="form-control" id="salesking_offers_search" placeholder="<?php esc_html_e('Search offers...','salesking');?>">
                                                </div>
                                            </li>
                                            
                                            <?php
                                                if (apply_filters('salesking_default_add_offer', true)){
                                                    if (apply_filters('b2bking_show_offers_page_add_button', true)){
                                                        ?>
                                                        <li class="nk-block-tools-opt">
                                                            <a class="b2bking_salesking_new_offer" href="#b2bking_salesking_new_offer_container" rel="modalzz:open">
                                                                <button class="btn btn-primary d-md-inline-flex"><em class="icon ni ni-plus"></em><span><?php esc_html_e('Add','salesking');?></span></button>
                                                            </a>
                                                        </li>
                                                        <?php
                                                    }
                                                } else {
                                                    do_action('salesking_alternative_add_offer');
                                                }
                                            ?>
                                        </ul>
                                    </div>
                                </div>
                            </div><!-- .nk-block-head-content -->
                        </div><!-- .nk-block-between -->
                    </div><!-- .nk-block-head -->
                    <table id="salesking_dashboard_offers_table" class="nk-tb-list is-separate mb-3">
                        <thead>
                            <tr class="nk-tb-item nk-tb-head">
                                <th class="nk-tb-col"><span class="sub-text"><?php esc_html_e('Offer name','salesking'); ?></span></th>
                                <th class="nk-tb-col tb-col-md"><span class="sub-text"><?php esc_html_e('Customers','salesking'); ?></span></th>
                                <th class="nk-tb-col tb-col-md"><span class="sub-text"><?php esc_html_e('Offer price','salesking'); ?></span></th>
                                <th class="nk-tb-col"><span class="sub-text"><?php esc_html_e('Actions','salesking'); ?></span></th>

                            </tr>
                        </thead>
                        <tbody>
                            <?php
                            if (!apply_filters('salesking_load_offers_table_ajax', false)){

                                // Show either all offers, or only offers created by this agent (default)
                                $offers = get_posts([
                                  'post_type' => 'b2bking_offer',
                                  'post_status' => 'publish',
                                  'numberposts' => -1,
                                  'fields' => 'ids',
                                ]);

                                if (apply_filters('salesking_agent_show_only_own_offers', true)){
                                    // remove offers not created by this agent
                                    foreach ($offers as $index => $offer_id){
                                        $created_by = get_post_meta($offer_id, 'offer_created_by', true);
                                        if ($created_by != get_current_user_id()){
                                            unset($offers[$index]);
                                        }
                                    }
                                }

                                foreach ($offers as $offer_id){

                                    $offer_details = get_post_meta($offer_id,'b2bking_offer_details',true);
                                    $offer_elements = explode('|',$offer_details);
                                    $currency_symbol = get_woocommerce_currency_symbol();

                                    ?>
                                    <tr class="nk-tb-item">
                                            <td class="nk-tb-col">
                                                <div>
                                                    <span><?php 

                                                    echo esc_html(get_the_title($offer_id));
                                                    do_action('salesking_after_offer_name', $offer_id, get_the_title($offer_id));

                                                ?></span>
                                                </div>
                                            </td>
                                            <td class="nk-tb-col tb-col-md"> 
                                                <div >
                                                    <span><?php 

                                                    $groups = get_posts([
                                                      'post_type' => 'b2bking_group',
                                                      'post_status' => 'publish',
                                                      'numberposts' => -1
                                                    ]);

                                                    $groups_message = '';
                                                    foreach ($groups as $group){
                                                        $check = intval(get_post_meta($offer_id, 'b2bking_group_'.$group->ID, true));
                                                        if ($check === 1){
                                                            $groups_message .= esc_html($group->post_title).', ';
                                                        }               
                                                    }
                                                    if ( ! empty($groups_message)){
                                                        echo '<strong>'.esc_html__('Groups: ','b2bking').'</strong>'.esc_html(substr($groups_message, 0, -2));
                                                        echo '<br />';
                                                    }

                                                    $users = get_post_meta($offer_id, 'b2bking_category_users_textarea', true);
                                                    if (!empty($users)){
                                                        echo '<strong>'.esc_html__('Users: ','b2bking').'</strong>'.esc_html($users);
                                                    }


                                                ?></span>
                                                </div>
                                            </td>
                                            <td class="nk-tb-col tb-col-md"> 
                                                <span><?php 

                                                        $price = 0;
                                                        foreach ($offer_elements as $element){
                                                            $element_array = explode(';',$element);
                                                            if(isset($element_array[1]) && isset($element_array[2])){
                                                                $price += $element_array[1]*$element_array[2];
                                                            }
                                                        }

                                                        echo '<strong>'.wc_price(esc_html($price)).'</strong>';

                                                ?></span>
                                            </td>

                                            <td class="nk-tb-col"> 
                                                <a href="#b2bking_salesking_new_offer_container" rel="modalzz:open"><button class="salesking-btn salesking-btn-default b2bking_offer_edit_table btn btn-secondary" type="button" value="<?php echo esc_attr($offer_id);?>"><?php esc_html_e('Edit','salesking');?></button></a>&nbsp;<button class="salesking-btn salesking-btn-default b2bking_offer_delete_table btn btn-secondary" type="button" value="<?php echo esc_attr($offer_id);?>"><?php esc_html_e('Delete','salesking');?></button>
                                            </td>

                                            
                                    </tr>
                                    <?php
                                }
                            }
                            ?>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        <div id="b2bking_salesking_new_offer_container" class="modalzz">
          <br>
            <!-- Show Offer Visibility -->
            <div class="b2bking_group_visibility_container" id="b2bking_groups_main_visibility">
                <div class="b2bking_group_visibility_container_top">
                    <?php esc_html_e( 'Group Visibility', 'salesking' ); ?>
                </div>
                <div class="b2bking_group_visibility_container_content">
                    <div class="b2bking_group_visibility_container_content_title">
                        <svg class="b2bking_group_visibility_container_content_title_icon" xmlns="http://www.w3.org/2000/svg" width="31" height="29" fill="none" viewBox="0 0 31 29"
                        <path fill="#C4C4C4" d="M15.5 6.792V.625H.083v27.75h30.834V6.792H15.5zm-9.25 18.5H3.167v-3.084H6.25v3.084zm0-6.167H3.167v-3.083H6.25v3.083zm0-6.167H3.167V9.875H6.25v3.083zm0-6.166H3.167V3.708H6.25v3.084zm6.167 18.5H9.333v-3.084h3.084v3.084zm0-6.167H9.333v-3.083h3.084v3.083zm0-6.167H9.333V9.875h3.084v3.083zm0-6.166H9.333V3.708h3.084v3.084zm15.416 18.5H15.5v-3.084h3.083v-3.083H15.5v-3.083h3.083v-3.084H15.5V9.875h12.333v15.417zM24.75 12.958h-3.083v3.084h3.083v-3.084zm0 6.167h-3.083v3.083h3.083v-3.083z"></path>
                        </svg>
                        <?php esc_html_e( 'Groups who can see this offer', 'salesking' ); ?>
                    </div>
                    <?php
                        $groups = get_posts([
                          'post_type' => 'b2bking_group',
                          'post_status' => 'publish',
                          'numberposts' => -1
                        ]);
                        foreach ($groups as $group){
                            ?>
                            <div class="b2bking_group_visibility_container_content_checkbox">
                                <div class="b2bking_group_visibility_container_content_checkbox_name">
                                    <?php echo esc_html($group->post_title); ?>
                                </div>
                                <input type="hidden" name="b2bking_group_<?php echo esc_attr($group->ID);?>" value="0">
                                <input type="checkbox" value="1" class="b2bking_group_visibility_container_content_checkbox_input" name="b2bking_group_<?php echo esc_attr($group->ID);?>" id="b2bking_group_<?php echo esc_attr($group->ID);?>" value="1" />
                            </div>
                            <?php
                        }
                    ?>
                </div>
            </div>

            <div class="b2bking_group_visibility_container">
                <div class="b2bking_group_visibility_container_top">
                    <?php esc_html_e( 'User Visibility', 'salesking' ); ?>
                </div>
                <div class="b2bking_group_visibility_container_content">
                    <div class="b2bking_group_visibility_container_content_title">
                        <svg class="b2bking_user_visibility_container_content_title_icon" xmlns="http://www.w3.org/2000/svg" width="31" height="23" fill="none" viewBox="0 0 31 23">
                          <path fill="#C4C4C4" d="M9.333 11.58c3.076 0 5.396-2.32 5.396-5.396C14.73 3.11 12.41.79 9.333.79c-3.075 0-5.396 2.32-5.396 5.395 0 3.076 2.32 5.396 5.396 5.396zm1.542 1.462H7.792c-4.25 0-7.709 3.458-7.709 7.708v1.542h18.5V20.75c0-4.25-3.458-7.708-7.708-7.708zm17.412-7.258l-6.63 6.616-1.991-1.992-2.18 2.18 4.171 4.17 8.806-8.791-2.176-2.183z"/>
                        </svg>
                        <?php esc_html_e( 'Users (username or email) who can see this offer, comma-separated.', 'salesking' ); ?>
                    </div>
                    <textarea name="b2bking_category_users_textarea" id="b2bking_category_users_textarea"></textarea>
                </div>
            </div>

            <!-- Show Custom Offer Text -->
            <div class="b2bking_group_visibility_container">
                <div class="b2bking_group_visibility_container_top">
                    <?php esc_html_e( 'Offer Custom Text', 'salesking' ); ?>
                </div>
                <div class="b2bking_group_visibility_container_content">
                    <div class="b2bking_group_visibility_container_content_title">
                        <svg class="b2bking_group_visibility_container_content_title_icon" xmlns="http://www.w3.org/2000/svg" width="39" height="39" fill="none" viewBox="0 0 39 39">
                          <path fill="#C4C4C4" fill-rule="evenodd" d="M29.25 2.438H9.75a4.875 4.875 0 00-4.875 4.874v24.375a4.875 4.875 0 004.875 4.875h19.5a4.875 4.875 0 004.875-4.874V7.313a4.875 4.875 0 00-4.875-4.875zM12.187 9.75a1.219 1.219 0 000 2.438h14.626a1.219 1.219 0 000-2.438H12.188zm-1.218 6.094a1.219 1.219 0 011.219-1.219h14.624a1.219 1.219 0 010 2.438H12.188a1.219 1.219 0 01-1.218-1.22zm1.219 3.656a1.219 1.219 0 000 2.438h14.624a1.219 1.219 0 000-2.438H12.188zm0 4.875a1.219 1.219 0 000 2.438H19.5a1.219 1.219 0 000-2.438h-7.313z" clip-rule="evenodd"/>
                        </svg>
                        <?php esc_html_e('Additional custom text to display for this offer','salesking');?>
                    </div>
                    <textarea name="b2bking_offer_customtext" id="b2bking_offer_customtext_textarea"></textarea>
                </div>
            </div>

            <!-- Show Offer Items -->
            <textarea id="b2bking_admin_offer_textarea" name="b2bking_admin_offer_textarea"></textarea>
            <div id="b2bking_offer_number_1" class="b2bking_offer_line_number">
                <div class="b2bking_offer_input_container">
                    <?php esc_html_e('Item name:','salesking'); ?>
                    <br />
                    <?php
                    if (intval(get_option( 'b2bking_offers_product_selector_setting', 0 )) === 1){
                        ?>
                        <select class="b2bking_offer_product_selector b2bking_offer_item_name">
                            <optgroup label="<?php esc_attr_e('Products (individual)', 'salesking'); ?>">
                                <?php
                                // Get all products
                                $products = get_posts( array(
                                    'post_type' => 'product',
                                    'post_status'=>'publish',
                                    'numberposts' => -1,
                                    'fields' => 'ids',
                                ));

                                foreach ($products as $product){
                                    $productobj = wc_get_product($product);

                                    // get regular price
                                    $regprice = apply_filters('b2bking_offer_price_default', $productobj->get_regular_price(), $productobj);
                                    $pricestring = '';
                                    if (!empty($regprice)){
                                        $pricestring = 'data-price="'.$regprice.'"';
                                    }

                                    echo '<option value="product_'.esc_attr($product).'" '.$pricestring.' >'.esc_html($productobj->get_name()).'</option>';
                                }
                                ?>
                            </optgroup>
                            <optgroup label="<?php esc_attr_e('Products (Individual Variations)', 'salesking'); ?>">
                                <?php
                                // Get all products
                                $products = get_posts(array(
                                    'post_type' => 'product_variation',
                                    'post_status'=>'publish',
                                    'numberposts' => -1,
                                    'fields' => 'ids',
                                ));

                                foreach ($products as $product){
                                    $productobj = wc_get_product($product);

                                    // get regular price
                                    $regprice = apply_filters('b2bking_offer_price_default', $productobj->get_regular_price(), $productobj);
                                    $pricestring = '';
                                    if (!empty($regprice)){
                                        $pricestring = 'data-price="'.$regprice.'"';
                                    }

                                    echo '<option value="product_'.esc_attr($product).'" '.$pricestring.' >'.esc_html($productobj->get_name()).'</option>';
                                }
                                ?>
                            </optgroup>
                <optgroup label="<?php esc_attr_e('Custom Options', 'salesking'); ?>">
                  <?php
                  echo '<option value="shipping">'.esc_html__('Shipping Costs','salesking').'</option>';
                  ?>
                </optgroup>
                        </select>
                    <?php } else { ?>
                    <input type="text" class="b2bking_offer_text_input b2bking_offer_item_name" placeholder="<?php esc_attr_e('Enter the item name','salesking'); ?>">
                <?php } ?>
                </div>
                <div class="b2bking_offer_input_container">
                    <?php esc_html_e('Item quantity:','salesking'); ?>
                    <br />
                    <input type="number" min="0" class="b2bking_offer_text_input b2bking_offer_item_quantity" placeholder="<?php esc_attr_e('Enter the quantity','salesking'); ?>">
                </div>
                <div class="b2bking_offer_input_container">
                    <?php esc_html_e('Unit price:','salesking'); ?>
                    <br />
                    <input type="number" step="0.0001" min="0" class="b2bking_offer_text_input b2bking_offer_item_price" placeholder="<?php esc_attr_e('Enter the unit price','salesking'); ?>"> 
                </div>
                <div class="b2bking_offer_input_container">
                    <?php esc_html_e('Item subtotal:','salesking'); ?>
                    <br />
                    <div class="b2bking_item_subtotal"><?php echo get_woocommerce_currency_symbol();?>0</div>
                </div>
                <div class="b2bking_offer_input_container">
                    <br />
                    <button type="button" class="button-primary button b2bking_offer_add_item_button btn btn-secondary"><?php esc_html_e('Add item','salesking'); ?></button>
                </div> 
                <br /><br />
            </div>

            <!-- Show Offer Subtotals-->
            <br /><hr>
            <div id="b2bking_offer_total_text">
                <?php 
                esc_html_e('Offer Total: ','salesking'); 
                ?>
                <div id="b2bking_offer_total_text_number">
                    <?php echo get_woocommerce_currency_symbol();?>0
                </div>
            </div>
            <br />
            <?php esc_html_e('Offer Title:','salesking'); ?>
            <input type="text" required id="b2bking_new_offer_title" class="b2bking_offer_text_input b2bking_offer_item_name" placeholder="<?php esc_attr_e('Enter the offer title here','salesking'); ?>">
            <input type="hidden" id="b2bking_new_offer_user_id" value="<?php echo esc_attr($user_id); ?>">
            <br /><br />
            <div class="b2bking_salesking_save_new_offer_button_container">
                <button type="button" value="new" class="salesking-btn salesking-btn-theme b2bking_salesking_save_new_offer btn btn-secondary"><?php esc_html_e('Save Offer','salesking');?></button>
            </div>
          </div>
        </div>
    </div>
    <?php
}
?>