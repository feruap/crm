<?php
if ( ! defined( 'ABSPATH' ) ) exit; // Exit if accessed directly

class B2BKing_Purchase_Order_Gateway extends WC_Payment_Gateway {

	public $token;
	public $instructions;

	public function __construct () {
		$this->token 			= 'b2bking-purchase-order-gateway';
		$this->id                 = 'B2BKing_Purchase_Order_Gateway';
		$this->method_title       = __( 'Purchase Order', 'b2bking' );
        $this->method_description = __( 'Allows customers to enter their purchase order number at checkout. This number will be manually provided to the customer.' );
		$this->has_fields         = true;

		$this->init_form_fields();
		$this->init_settings();

		$this->title = $this->settings['title'];
		$this->description = $this->settings['description'];

		add_action( 'woocommerce_update_options_payment_gateways_' . $this->id, array( $this, 'process_admin_options' ) );
		add_action( 'woocommerce_thankyou_' . $this->id, array( $this, 'thank_you' ) );
	}

    /**
	 * Register the gateway's fields.
	 * @access public
	 * @since  1.0.0
	 * @return void
	 */
	public function init_form_fields () {
	   $this->form_fields = array(
	            'enabled' => array(
	                'title' => __( 'Enable/Disable', 'b2bking' ),
	                'type' => 'checkbox',
	                'label' => __( 'Enable Purchase Orders.', 'b2bking' ),
	                'default' => 'no' ),
	            'title' => array(
	                'title' => __( 'Title:', 'b2bking' ),
	                'type'=> 'text',
	                'description' => __( 'This controls the title which the user sees during checkout.', 'b2bking' ),
	                'default' => __( 'Purchase Order', 'b2bking' ) ),
	            'description' => array(
	                'title' => __( 'Description:', 'b2bking' ),
	                'type' => 'textarea',
	                'description' => __( 'This controls the description which the user sees during checkout.', 'b2bking' ),
	                'default' => __( 'Please add your P.O. number below.', 'b2bking' ) ),
				 'instructions' => array(
	                'title' => __('Thank You note:', 'b2bking'),
	                'type' => 'textarea',
	                'instructions' => __( 'Instructions that will be added to the thank you page.', 'b2bking' ),
	                'default' => '' )

	        );
	}


	public function admin_options () {
		echo '<h3>'.__( 'Purchase Order Payment Gateway', 'b2bking' ) . '</h3>';
		echo '<table class="form-table">';
		// Generate the HTML For the settings form.
		$this->generate_settings_html();
		echo '</table>';
	}


    public function payment_fields() {
        if( $this->description ) echo wpautop( wptexturize( $this->description ) );

        $po_number = '';
        if ( isset( $_REQUEST['post_data'] ) ) {
            parse_str( $_REQUEST['post_data'], $post_data );
            if ( isset( $post_data['po_number_field'] ) ) {
                $po_number = $post_data['po_number_field'];
            }
        }
        ?>
        <fieldset>
            <p class="form-row form-row-first">
                <label for="poorder"><?php esc_html_e( 'P.O. Number:', 'b2bking' ); ?> <?php 

                if (apply_filters('b2bking_po_number_optional', false)){
                	//esc_html_e('(optional)', 'b2bking');
                } else {
                	?> <span class="required">*</span></label><?php
                }

                ?>
                <input type="text" class="input-text" value="<?php echo esc_attr( $po_number ); ?>" id="po_number_field" name="po_number_field" />
            </p>
            <?php
            if (apply_filters('b2bking_allow_po_document', false)){
            	?>
            	<p class="form-row form-row-wide">
            	    <label for="b2bkingfileupload"><?php esc_html_e( 'Upload Document (optional)', 'b2bking' ); ?></label>
            	    <div id="b2bkingfileupload" class="b2bking-drop-area">
            	    	<svg xmlns="http://www.w3.org/2000/svg" width="50" height="65" fill="none" viewBox="0 0 88 88">
            	    	  <path stroke="#487BFE" stroke-linecap="round" stroke-linejoin="round" stroke-width="4" d="M55 63.214h13.063c9.453 0 17.187-5.02 17.187-14.369 0-9.348-9.11-14.002-16.5-14.369C67.222 19.856 56.547 10.964 44 10.964c-11.86 0-19.497 7.87-22 15.675-10.313.98-19.25 7.542-19.25 18.287 0 10.746 9.281 18.288 20.625 18.288H33"/>
            	    	  <path stroke="#487BFE" stroke-linecap="round" stroke-linejoin="round" stroke-width="4" d="m55 43.964-11-11-11 11m11 33.072V35.714"/>
            	    	</svg>
            	        <?php esc_html_e( 'Drag & Drop a file here or click to upload', 'b2bking' ); ?>
            	        <input type="file" name="b2bkingpofile" id="b2bkingpofile" accept="image/*, application/pdf" style="display:none">
            	        <ul id="b2bkingfilelist"></ul> <!-- The list where the selected file name will be shown -->
            	    </div>
            	</p>
            	<?php
            }
        ?>
        </fieldset>
        <?php
        if (apply_filters('b2bking_allow_po_document', false)){
        	?>
	        <script>
	            var dropArea = document.getElementById('b2bkingfileupload');
	            var b2bkingfilelist = document.getElementById('b2bkingfilelist');

	            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
	                dropArea.addEventListener(eventName, preventDefaults, false);
	                document.body.addEventListener(eventName, preventDefaults, false); // Prevent defaults globally
	            });

	            function preventDefaults(e) {
	                e.preventDefault();
	                e.stopPropagation();
	            }

	            ['dragenter', 'dragover'].forEach(eventName => {
	                dropArea.addEventListener(eventName, highlight, false);
	            });

	            ['dragleave', 'drop'].forEach(eventName => {
	                dropArea.addEventListener(eventName, unhighlight, false);
	            });

	            function highlight(e) {
	                dropArea.classList.add('highlight');
	            }

	            function unhighlight(e) {
	                dropArea.classList.remove('highlight');
	            }

	            dropArea.addEventListener('drop', handleDrop, false);

	            function handleDrop(e) {
	                var dt = e.dataTransfer;
	                var file = dt.files[0]; // Handle only the first file

	                handleFile(file);
	            }

	            dropArea.onclick = function() {
	                b2bkingpofile.click();
	            };

	            b2bkingpofile.onchange = function() {
	                var file = this.files[0]; // Handle only the first file
	                handleFile(file);
	            };

	            function handleFile(file) {
	                b2bkingfilelist.innerHTML = ""; // Clear the list every time a new file is added
	                displayFile(file);
	            }

	            function displayFile(file) {
	                if (file !== undefined) {
	                    var li = document.createElement('li');
	                    li.textContent = file.name + " ";
	                    var removeButton = document.createElement('button');
	                    
	                    // Use innerHTML to set the SVG markup so it gets parsed as HTML
	                    removeButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" fill="none" viewBox="0 0 36 36"><g clip-path="url(#a)"><path fill="#575757" d="m19.61 18 4.86-4.86a1 1 0 0 0-1.41-1.41l-4.86 4.81-4.89-4.89a1 1 0 0 0-1.41 1.41L16.78 18 12 22.72a1 1 0 1 0 1.41 1.41l4.77-4.77 4.74 4.74a1 1 0 0 0 1.41-1.41L19.61 18Z"/><path fill="#575757" d="M18 34a16 16 0 1 1 0-32 16 16 0 0 1 0 32Zm0-30a14 14 0 1 0 0 28 14 14 0 0 0 0-28Z"/></g><defs><clipPath id="a"><path fill="#fff" d="M0 0h36v36H0z"/></clipPath></defs></svg>';

	                    removeButton.onclick = function(e) {
	                        e.stopPropagation();
	                        li.remove();
	                        // Clear the input value so the user can upload the same file again if they wish
	                        document.getElementById('b2bkingpofile').value = "";
	                    };

	                    li.appendChild(removeButton);
	                    document.getElementById('b2bkingfilelist').appendChild(li); // Assuming b2bkingfilelist is an ID of an existing element
	                }
	            }

	        </script>
	        <?php
	    }
	    ?>
        
       <?php
   }

	public function process_payment( $order_id ) {
		$order = new WC_Order( $order_id );

		$poorder = $this->get_post( 'po_number_field' );

		if ( isset( $poorder ) ) {
			$order->update_meta_data( 'po_number', esc_attr( $poorder ) );
			$order->set_transaction_id( esc_attr( $poorder ) );
			$order->save();
		}

		$order->update_status( apply_filters( 'b2bking_purchase_order_status', 'on-hold', $order ), esc_html__( 'Waiting to be processed', 'b2bking' ) );


		// Reduce stock levels
		if ( version_compare( WC_VERSION, '3.0', '<' ) ) {
			$order->reduce_order_stock();
		} else {
			wc_reduce_stock_levels( $order->get_id() );
		}

		// Remove cart
		WC()->cart->empty_cart();

		// Return thankyou redirect
		return array(
		'result' 	=> 'success',
		'redirect'	=> $this->get_return_url( $order )
		);
	}

	public function thank_you () {
        echo $this->settings['instructions'] != '' ? wpautop( $this->settings['instructions'] ) : '';
    }

	private function get_post ( $name ) {
		if( isset( $_POST[$name] ) ) {
			return $_POST[$name];
		} else {
			return NULL;
		}
	}

	public function validate_fields () {

		if (apply_filters('b2bking_po_number_optional', false)){
			return true;
		}

		$poorder = $this->get_post( 'po_number_field' );
		
		if( ! $poorder || empty ($poorder)) {
			if ( function_exists ( 'wc_add_notice' ) ) {
				// Replace deprecated $woocommerce_add_error() function.
				wc_add_notice ( __ ( 'Please enter your PO Number.', 'b2bking' ), 'error' );
			} else {
				WC()->add_error( __( 'Please enter your PO Number.', 'b2bking' ) );
			}
			return false;
		} else {
			return true;
		}
	}

}
