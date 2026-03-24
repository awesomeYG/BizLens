-- 电商示例数据（SQLite 版本）

CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    city TEXT,
    province TEXT,
    registered_at TEXT NOT NULL,
    vip_level TEXT DEFAULT 'normal' CHECK(vip_level IN ('normal','silver','gold','platinum'))
);

CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    parent_id INTEGER DEFAULT NULL,
    FOREIGN KEY (parent_id) REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category_id INTEGER NOT NULL,
    price REAL NOT NULL,
    cost REAL NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'on_sale' CHECK(status IN ('on_sale','off_shelf','out_of_stock')),
    created_at TEXT NOT NULL,
    FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_no TEXT NOT NULL UNIQUE,
    customer_id INTEGER NOT NULL,
    total_amount REAL NOT NULL,
    discount_amount REAL DEFAULT 0,
    pay_amount REAL NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending','paid','shipped','delivered','cancelled','refunded')),
    payment_method TEXT CHECK(payment_method IN ('wechat','alipay','credit_card','bank_transfer')),
    created_at TEXT NOT NULL,
    paid_at TEXT,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price REAL NOT NULL,
    subtotal REAL NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);
