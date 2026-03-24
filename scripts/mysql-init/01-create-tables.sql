-- ============================================================
-- 测试数据库: demo_ecommerce
-- 模拟一个小型电商平台的数据，用于验证数据源连接和 AI 分析功能
-- ============================================================

CREATE DATABASE IF NOT EXISTS demo_ecommerce;
USE demo_ecommerce;

-- -----------------------------------------------------------
-- 用户表
-- -----------------------------------------------------------
CREATE TABLE customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    phone VARCHAR(20),
    city VARCHAR(50),
    province VARCHAR(50),
    registered_at DATETIME NOT NULL,
    vip_level ENUM('normal', 'silver', 'gold', 'platinum') DEFAULT 'normal'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -----------------------------------------------------------
-- 商品分类表
-- -----------------------------------------------------------
CREATE TABLE categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(80) NOT NULL,
    parent_id INT DEFAULT NULL,
    FOREIGN KEY (parent_id) REFERENCES categories(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -----------------------------------------------------------
-- 商品表
-- -----------------------------------------------------------
CREATE TABLE products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    category_id INT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    cost DECIMAL(10, 2) NOT NULL,
    stock INT NOT NULL DEFAULT 0,
    status ENUM('on_sale', 'off_shelf', 'out_of_stock') DEFAULT 'on_sale',
    created_at DATETIME NOT NULL,
    FOREIGN KEY (category_id) REFERENCES categories(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -----------------------------------------------------------
-- 订单表
-- -----------------------------------------------------------
CREATE TABLE orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_no VARCHAR(32) NOT NULL UNIQUE,
    customer_id INT NOT NULL,
    total_amount DECIMAL(12, 2) NOT NULL,
    discount_amount DECIMAL(10, 2) DEFAULT 0,
    pay_amount DECIMAL(12, 2) NOT NULL,
    status ENUM('pending', 'paid', 'shipped', 'delivered', 'cancelled', 'refunded') DEFAULT 'pending',
    payment_method ENUM('wechat', 'alipay', 'credit_card', 'bank_transfer') DEFAULT NULL,
    created_at DATETIME NOT NULL,
    paid_at DATETIME DEFAULT NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -----------------------------------------------------------
-- 订单明细表
-- -----------------------------------------------------------
CREATE TABLE order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    subtotal DECIMAL(12, 2) NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -----------------------------------------------------------
-- 每日销售汇总表（模拟报表场景）
-- -----------------------------------------------------------
CREATE TABLE daily_sales_summary (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sale_date DATE NOT NULL,
    total_orders INT NOT NULL DEFAULT 0,
    total_revenue DECIMAL(14, 2) NOT NULL DEFAULT 0,
    total_cost DECIMAL(14, 2) NOT NULL DEFAULT 0,
    total_profit DECIMAL(14, 2) NOT NULL DEFAULT 0,
    avg_order_value DECIMAL(10, 2) NOT NULL DEFAULT 0,
    new_customers INT NOT NULL DEFAULT 0,
    UNIQUE KEY (sale_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
