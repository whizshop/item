// Array to store products
let products = JSON.parse(localStorage.getItem('products')) || [];
let cart = JSON.parse(localStorage.getItem('cart')) || [];

// Upload Product Form
document.getElementById('upload-form')?.addEventListener('submit', function (e) {
    e.preventDefault();

    const image = document.getElementById('product-image').files[0];
    const name = document.getElementById('product-name').value;
    const description = document.getElementById('product-description').value;
    const price = document.getElementById('product-price').value;

    if (image && name && description && price) {
        const product = {
            id: Date.now(), // Unique ID for each product
            image: URL.createObjectURL(image),
            name: name,
            description: description,
            price: parseFloat(price),
        };
        products.push(product);
        localStorage.setItem('products', JSON.stringify(products));
        alert('Product uploaded successfully!');
        window.location.href = 'index.html'; // Redirect to home page
    }
});

// Display Products on Home Page
function displayProducts() {
    const productList = document.getElementById('product-list');
    if (productList) {
        productList.innerHTML = products
            .map(
                (product) => `
                <div class="product">
                    <img src="${product.image}" alt="${product.name}">
                    <h3>${product.name}</h3>
                    <p>${product.description}</p>
                    <p>$${product.price.toFixed(2)}</p>
                    <button onclick="addToCart(${product.id})">Add to Cart</button>
                </div>
            `
            )
            .join('');
    }
}

// Add Product to Cart
function addToCart(productId) {
    const product = products.find((p) => p.id === productId);
    if (product) {
        cart.push(product);
        localStorage.setItem('cart', JSON.stringify(cart));
        alert('Product added to cart!');
    }
}

// Display Cart Items
function displayCart() {
    const cartItems = document.getElementById('cart-items');
    const cartTotal = document.getElementById('cart-total');
    if (cartItems && cartTotal) {
        cartItems.innerHTML = cart
            .map(
                (item) => `
                <div class="cart-item">
                    <img src="${item.image}" alt="${item.name}">
                    <h3>${item.name}</h3>
                    <p>$${item.price.toFixed(2)}</p>
                </div>
            `
            )
            .join('');

        const total = cart.reduce((sum, item) => sum + item.price, 0);
        cartTotal.textContent = total.toFixed(2);
    }
}

// Call display functions when the page loads
window.onload = function () {
    displayProducts();
    displayCart();
};
