<?php
if (intval(get_option( 'salesking_enable_payouts_setting', 1 )) === 1){
    ?>
    <div class="nk-content salesking_payouts_page">
        <div class="container-fluid">
            <div class="nk-content-inner">
                <div class="nk-content-body">
                    <div class="components-preview wide-md mx-auto">
                        <div class="nk-block-head nk-block-head-sm">
                            <div class="nk-block-between">
                                <div class="nk-block-head-content">
                                    <h3 class="nk-block-title page-title"><?php esc_html_e('Payouts','salesking');?></h3>
                                    <div class="nk-block-des text-soft">
                                        <p><?php esc_html_e('View and keep track of your payouts.','salesking');?></p>
                                    </div>
                                </div><!-- .nk-block-head-content -->
                               
                            </div><!-- .nk-block-between -->
                        </div><!-- .nk-block-head -->
                        <div class="nk-block">
                            <div class="row g-gs">
                                <div class="col-xxl-6 col-sm-6">
                                    <div class="card text-white bg-primary">
                                        <div class="card-header"><?php esc_html_e('Available for Payout','salesking');?></div>
                                        <div class="card-inner">
                                            <h5 class="card-title"><?php 

                                            $outstanding_balance = get_user_meta($user_id,'salesking_outstanding_earnings', true);
                                            if (empty($outstanding_balance)){
                                                $outstanding_balance = 0;
                                            }
                                            echo wc_price($outstanding_balance);

                                            ?></h5>
                                            <p class="card-text"><?php esc_html_e('This is the amount you currently have in earnings, available for your next payout.','salesking');?></p>
                                        </div>
                                    </div>
                                </div><!-- .col -->
                                <div class="col-xxl-6 col-sm-6">
                                    <div class="card bg-lighten h-100">
                                        <div class="card-header"><?php esc_html_e('Payout Account','salesking');?></div>
                                        <div class="card-inner">
                                            <?php
                                            // get method set if any
                                            $method = get_user_meta($user_id,'salesking_agent_selected_payout_method', true);
                                            if ($method === 'paypal'){
                                                $method = 'PayPal';
                                            } else if ($method === 'bank'){
                                                $method = 'Bank';
                                            } else if ($method === 'custom'){
                                                $method = get_option( 'salesking_enable_custom_payouts_title_setting', '' );
                                            }
                                            ?>
                                            <h6 class="card-title mb-4"><?php esc_html_e('Set payout account','salesking');?> <?php if (!empty($method)){echo '('.wp_kses( nl2br($method), array( 'br' => true, 'strong' => true, 'b' => true, 'a' => array(
                                            'href' => array(), 'target' => array() ) ) ).' '.esc_html__('currently selected', 'salesking').')';}?></h6>
                                            <a href="#" class="btn btn-gray btn-sm" data-toggle="modal" data-target="#modal_set_payout_method"><em class="icon ni ni-setting"></em><span><?php esc_html_e('Configure','salesking');?></span> </a>
                                        </div>
                                    </div>
                                </div><!-- .col -->
                                <div class="col-xxl-12">
                                    <div class="card card-full">
                                        <div class="card-inner">
                                            <div class="card-title-group">
                                                <div class="card-title">
                                                    <h6 class="title"><?php esc_html_e('Recent Payouts','salesking');?></h6>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="nk-tb-list mt-n2">
                                            <div class="nk-tb-item nk-tb-head">
                                                <div class="nk-tb-col"><span><?php esc_html_e('Amount','salesking');?></span></div>
                                                <div class="nk-tb-col tb-col-sm"><span><?php esc_html_e('Payment Method','salesking');?></span></div>
                                                <div class="nk-tb-col tb-col-md"><span><?php esc_html_e('Date Processed','salesking');?></span></div>
                                                <div class="nk-tb-col"><span class="d-none d-sm-inline"><?php esc_html_e('Notes','salesking');?></span></div>
                                            </div>
                                            <?php
                                            $user_payout_history = sanitize_text_field(get_user_meta($user_id,'salesking_user_payout_history', true));

                                            if ($user_payout_history){
                                                $transactions = explode(';', $user_payout_history);
                                                $transactions = array_filter($transactions);
                                            } else {
                                                // empty, no transactions
                                                $transactions = array();
                                            }
                                            $transactions = array_reverse($transactions);
                                            foreach ($transactions as $transaction){
                                                $elements = explode(':', $transaction);
                                                $date = $elements[0];
                                                $amount = $elements[1];
                                                $oustanding_balance = $elements[2];
                                                $note = $elements[3];
                                                $method = $elements[4];
                                                ?>
                                                <div class="nk-tb-item">
                                                    <div class="nk-tb-col">
                                                        <span class="tb-sub tb-amount"><?php echo wc_price($amount);?></span>
                                                    </div>
                                                    <div class="nk-tb-col tb-col-sm">
                                                        <div class="user-card">
                                                            <div class="user-name">
                                                                <span class="tb-lead"><?php echo $method;?></span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div class="nk-tb-col tb-col-md">
                                                        <span class="tb-sub"><?php echo esc_html($date);?></span>
                                                    </div>

                                                    <div class="nk-tb-col salesking_column_limited_width">
                                                        <span class="tb-sub"><?php echo esc_html($note);?></span>
                                                    </div>
                                                </div>
                                                <?php
                                            }
                                            ?>
                                        </div>
                                    </div><!-- .card -->
                                </div>
                            </div>
                        </div><!-- .row -->
                    </div><!-- .nk-block -->
                </div>
            </div>
        </div>
        <div class="modal fade" tabindex="-1" id="modal_set_payout_method">
            <div class="modal-dialog" role="document">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title"><?php esc_html_e('Set Payout Method','salesking'); ?></h5>
                        <a href="#" class="close" data-dismiss="modal" aria-label="Close">
                            <em class="icon ni ni-cross"></em>
                        </a>
                    </div>
                    <div class="modal-body">
                        <form action="#" class="form-validate is-alter" id="salesking_set_payout_form">
                            <h6><?php esc_html_e('Select a payment method:','salesking');?></h6><br>
                            <?php
                            // get all configured methods: paypal, bank, custom
                            $paypal = intval(get_option( 'salesking_enable_paypal_payouts_setting', 1 ));
                            $bank = intval(get_option( 'salesking_enable_bank_payouts_setting', 0 ));
                            $custom = intval(get_option( 'salesking_enable_custom_payouts_setting', 0 ));
                            $title = get_option( 'salesking_enable_custom_payouts_title_setting', '' );
                            $description = get_option( 'salesking_enable_custom_payouts_description_setting', '' );

                            // get currently selected method if any
                            $selected = get_user_meta($user_id,'salesking_agent_selected_payout_method', true);
                            if ($paypal === 1){
                                ?>
                                 <div class="g mb-1">
                                    <div class="custom-control custom-control custom-radio">
                                        <input type="radio" class="custom-control-input" name="saleskingpayoutMethod" id="paypalMethod" value="paypal" <?php checked('paypal', $selected, true);?>>
                                        <label class="custom-control-label" for="paypalMethod"><?php esc_html_e('PayPal','salesking');?></label>
                                    </div>
                                </div>
                                <?php
                            }
                            if ($bank === 1){
                                ?>
                               <div class="g mb-1">
                                   <div class="custom-control custom-radio">
                                       <input type="radio" class="custom-control-input" name="saleskingpayoutMethod" id="bankMethod" value="bank" <?php checked('bank', $selected, true);?>>
                                       <label class="custom-control-label" for="bankMethod"><?php esc_html_e('Bank Transfer','salesking');?></label>
                                   </div>
                               </div>
                               <?php
                            }
                            if ($custom === 1){
                                ?>
                               <div class="g mb-1">
                                   <div class="custom-control custom-control custom-radio">
                                       <input type="radio" class="custom-control-input" name="saleskingpayoutMethod" id="customMethod" value="custom" <?php checked('custom', $selected, true);?>>
                                       <label class="custom-control-label" for="customMethod"><?php 

                                       echo wp_kses( nl2br($title), array( 'br' => true, 'strong' => true, 'b' => true, 'a' => array(
                                               'href' => array(), 'target' => array() ) ) );

                                        ?></label>
                                   </div>
                               </div>
                               <?php
                           }
                           ?>
                           <br>
                           <?php
                           $info = base64_decode(get_user_meta($user_id,'salesking_payout_info', true));
                           $info = explode('**&&', $info);
                            if ($paypal === 1){
                                ?>

                                <div class="form-group salesking_paypal_info">
                                    <label class="form-label" for="paypal-email"><?php esc_html_e('PayPal Email Address','salesking'); ?></label>
                                    <div class="form-control-wrap">
                                        <input type="email" class="form-control" id="paypal-email" name="paypal-email" placeholder="<?php esc_html_e('Enter your PayPal email address here...','salesking');?>" value="<?php echo esc_attr($info[0]);?>">
                                    </div>
                                </div>
                                <?php
                            }

                            if ($bank === 1){
                                ?>
                                <div class="form-group salesking_bank_info">
                                    <label class="form-label" for="full-name"><?php esc_html_e('Full Name','salesking'); ?></label>
                                    <div class="form-control-wrap">
                                        <input type="text" class="form-control" id="full-name" name="full-name" value="<?php 

                                        if (isset($info[2])){
                                            echo esc_attr($info[2]);
                                        }


                                        ?>">
                                    </div>
                                </div>
                                <div class="form-group salesking_bank_info">
                                    <label class="form-label" for="billing-address-1"><?php esc_html_e('Billing Address Line 1','salesking'); ?></label>
                                    <div class="form-control-wrap">
                                        <input type="text" class="form-control" id="billing-address-1" name="billing-address-1" value="<?php 

                                        if (isset($info[3])){
                                            echo esc_attr($info[3]);
                                        }

                                        ?>">
                                    </div>
                                </div>
                                <div class="form-group salesking_bank_info">
                                    <label class="form-label" for="billing-address-2"><?php esc_html_e('Billing Address Line 2','salesking'); ?></label>
                                    <div class="form-control-wrap">
                                        <input type="text" class="form-control" id="billing-address-2" name="billing-address-2" value="<?php 

                                        if (isset($info[4])){
                                            echo esc_attr($info[4]);
                                        }

                                        ?>">
                                    </div>
                                </div>
                                <div class="form-group salesking_bank_info">
                                    <label class="form-label" for="city"><?php esc_html_e('City','salesking'); ?></label>
                                    <div class="form-control-wrap">
                                        <input type="text" class="form-control" id="city" name="city" value="<?php 
                                        if (isset($info[5])){
                                            echo esc_attr($info[5]);
                                        }
                                        ?>">
                                    </div>
                                </div>
                                <div class="form-group salesking_bank_info">
                                    <label class="form-label" for="state"><?php esc_html_e('State','salesking'); ?></label>
                                    <div class="form-control-wrap">
                                        <input type="text" class="form-control" id="state" name="state" value="<?php 
                                        if (isset($info[6])){
                                            echo esc_attr($info[6]);
                                        }
                                        ?>">
                                    </div>
                                </div>
                                <div class="form-group salesking_bank_info">
                                    <label class="form-label" for="postcode"><?php esc_html_e('Postcode','salesking'); ?></label>
                                    <div class="form-control-wrap">
                                        <input type="text" class="form-control" id="postcode" name="postcode" value="<?php 
                                        if (isset($info[7])){
                                            echo esc_attr($info[7]);
                                        }
                                        ?>">
                                    </div>
                                </div>
                                <div class="form-group salesking_bank_info">
                                    <label class="form-label" for="country"><?php esc_html_e('Country','salesking'); ?></label>
                                    <div class="form-control-wrap">
                                        <input type="text" class="form-control" id="country" name="country" value="<?php 
                                        if (isset($info[8])){
                                            echo esc_attr($info[8]);
                                        }
                                        ?>">
                                    </div>
                                </div>
                                <div class="form-group salesking_bank_info">
                                    <label class="form-label" for="bank-account-holder-name"><?php esc_html_e('Bank Account Holder Name','salesking'); ?></label>
                                    <div class="form-control-wrap">
                                        <input type="text" class="form-control" id="bank-account-holder-name" name="bank-account-holder-name" value="<?php 
                                        if (isset($info[9])){
                                            echo esc_attr($info[9]);
                                        }
                                        ?>">
                                    </div>
                                </div>
                                <div class="form-group salesking_bank_info">
                                    <label class="form-label" for="bank-account-number"><?php esc_html_e('Bank Account Number/IBAN','salesking'); ?></label>
                                    <div class="form-control-wrap">
                                        <input type="text" class="form-control" id="bank-account-number" name="bank-account-number" value="<?php 
                                        if (isset($info[10])){
                                            echo esc_attr($info[10]);
                                        }
                                        ?>">
                                    </div>
                                </div>
                                <div class="form-group salesking_bank_info">
                                    <label class="form-label" for="bank-branch-city"><?php esc_html_e('Bank Branch City','salesking'); ?></label>
                                    <div class="form-control-wrap">
                                        <input type="text" class="form-control" id="bank-branch-city" name="bank-branch-city" value="<?php 
                                        if (isset($info[11])){
                                            echo esc_attr($info[11]);
                                        }
                                        ?>">
                                    </div>
                                </div>
                                <div class="form-group salesking_bank_info">
                                    <label class="form-label" for="bank-branch-country"><?php esc_html_e('Bank Branch Country','salesking'); ?></label>
                                    <div class="form-control-wrap">
                                        <input type="text" class="form-control" id="bank-branch-country" name="bank-branch-country" value="<?php 
                                        if (isset($info[12])){
                                            echo esc_attr($info[12]);
                                        }
                                        ?>">
                                    </div>
                                </div>
                                <div class="form-group salesking_bank_info">
                                    <label class="form-label" for="intermediary-bank-bank-code"><?php esc_html_e('Intermediary Bank - Bank Code','salesking'); ?></label>
                                    <div class="form-control-wrap">
                                        <input type="text" class="form-control" id="intermediary-bank-bank-code" name="intermediary-bank-bank-code" value="<?php 
                                        if (isset($info[13])){
                                            echo esc_attr($info[13]);
                                        }
                                        ?>">
                                    </div>
                                </div>
                                <div class="form-group salesking_bank_info">
                                    <label class="form-label" for="intermediary-bank-name"><?php esc_html_e('Intermediary Bank - Name','salesking'); ?></label>
                                    <div class="form-control-wrap">
                                        <input type="text" class="form-control" id="intermediary-bank-name" name="intermediary-bank-name" value="<?php 
                                        if (isset($info[14])){
                                            echo esc_attr($info[14]);
                                        }
                                     ?>">
                                    </div>
                                </div>
                                <div class="form-group salesking_bank_info">
                                    <label class="form-label" for="intermediary-bank-city"><?php esc_html_e('Intermediary Bank - City','salesking'); ?></label>
                                    <div class="form-control-wrap">
                                        <input type="text" class="form-control" id="intermediary-bank-city" name="intermediary-bank-city" value="<?php 
                                        if (isset($info[15])){
                                            echo esc_attr($info[15]);
                                        }
                                        ?>">
                                    </div>
                                </div>
                                <div class="form-group salesking_bank_info">
                                    <label class="form-label" for="intermediary-bank-country"><?php esc_html_e('Intermediary Bank - Country','salesking'); ?></label>
                                    <div class="form-control-wrap">
                                        <input type="text" class="form-control" id="intermediary-bank-country" name="intermediary-bank-country" value="<?php 
                                        if (isset($info[16])){
                                            echo esc_attr($info[16]);
                                        }
                                        ?>">
                                    </div>
                                </div>


                                <?php
                            }

                            if ($custom === 1){

                                ?>
                                <div class="form-group salesking_custom_info">
                                    <label class="form-label" for="paypal-email"><?php
                                        echo wp_kses( nl2br($title), array( 'br' => true, 'strong' => true, 'b' => true, 'a' => array(
                                                                                'href' => array(), 'target' => array() ) ) );
                                    ?></label>
                                    <div class="form-control-wrap">
                                        <input type="text" class="form-control" id="custom-method" name="custom-method" placeholder="<?php echo esc_attr($description);?>" value="<?php 

                                            if (isset($info[1])){
                                                echo esc_attr($info[1]);
                                            }

                                            ?>">
                                    </div>
                                </div>
                                <?php
                            }
                            ?>
                            <div class="form-group">
                                <button type="button" id="salesking_save_payout" class="btn btn-lg btn-primary"><?php esc_html_e('Save Info','salesking'); ?></button>
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
