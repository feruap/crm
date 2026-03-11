import axios from 'axios';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const WC_API_URL = process.env.WC_URL + '/wp-json/wc/v3/products';
const auth = {
    username: process.env.WC_KEY!,
    password: process.env.WC_SECRET!
};

async function getProducts() {
    try {
        const res = await axios.get(WC_API_URL, {
            auth,
            params: { per_page: 50 }
        });
        const products = res.data.map((p: any) => ({
            name: p.name,
            categories: p.categories.map((c: any) => c.name).join(', '),
            price: p.price
        }));
        console.log(JSON.stringify(products, null, 2));
    } catch (err: any) {
        console.error('Error fetching Products:', err.response?.data || err.message);
    }
}

getProducts();
