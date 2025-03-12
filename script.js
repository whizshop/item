// Array to store products
let products = [];
let cart = [];

// Upload Product Form
document.getElementById('upload-form')?.addEventListener('submit', function (e) {
    e.preventDefault();

    const image = document.getElementById('product-image').files[0];
    const description = document.getElementById('product-description').value;

    if (image && description) {
        const product = {
            id: Date.now(), // Unique ID for each product
            image: URL.createObjectURL(image),
            description: description,
        };
        products.push(product);
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
                    <img src="${product.image}" alt="${product.description}">
                    <p>${product.description}</p>
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
        alert('Product added to cart!');
    }
}

// Display Cart Items
function displayCart() {
    const cartItems = document.getElementById('cart-items');
    if (cartItems) {
        cartItems.innerHTML = cart
            .map(
                (item) => `
                <div class="cart-item">
                    <img src="${item.image}" alt="${item.description}">
                    <p>${item.description}</p>
                </div>
            `
            )
            .join('');
    }
}

// Call display functions when the page loads
window.onload = function () {
    displayProducts();
    displayCart();
};
