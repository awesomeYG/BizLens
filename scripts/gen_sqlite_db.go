package main

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

func mustExec(db *sql.DB, stmt string, args ...any) {
	if _, err := db.Exec(stmt, args...); err != nil {
		panic(fmt.Errorf("exec failed: %w", err))
	}
}

func main() {
	dbPath := "/tmp/demo_ecommerce.db"
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		panic(err)
	}
	defer db.Close()

	if _, err := db.Exec("PRAGMA foreign_keys = ON"); err != nil {
		panic(err)
	}

	schema := []string{
		`DROP TABLE IF EXISTS order_items`,
		`DROP TABLE IF EXISTS orders`,
		`DROP TABLE IF EXISTS products`,
		`DROP TABLE IF EXISTS categories`,
		`DROP TABLE IF EXISTS customers`,
		`CREATE TABLE customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            phone TEXT,
            city TEXT,
            province TEXT,
            registered_at TEXT NOT NULL,
            vip_level TEXT DEFAULT 'normal' CHECK(vip_level IN ('normal','silver','gold','platinum'))
        )`,
		`CREATE TABLE categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            parent_id INTEGER,
            FOREIGN KEY (parent_id) REFERENCES categories(id)
        )`,
		`CREATE TABLE products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category_id INTEGER NOT NULL,
            price REAL NOT NULL,
            cost REAL NOT NULL,
            stock INTEGER NOT NULL DEFAULT 0,
            status TEXT DEFAULT 'on_sale' CHECK(status IN ('on_sale','off_shelf','out_of_stock')),
            created_at TEXT NOT NULL,
            FOREIGN KEY (category_id) REFERENCES categories(id)
        )`,
		`CREATE TABLE orders (
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
        )`,
		`CREATE TABLE order_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            quantity INTEGER NOT NULL,
            unit_price REAL NOT NULL,
            subtotal REAL NOT NULL,
            FOREIGN KEY (order_id) REFERENCES orders(id),
            FOREIGN KEY (product_id) REFERENCES products(id)
        )`,
	}

	tx, err := db.BeginTx(context.Background(), nil)
	if err != nil {
		panic(err)
	}
	for _, stmt := range schema {
		if _, err := tx.Exec(stmt); err != nil {
			_ = tx.Rollback()
			panic(fmt.Errorf("apply schema failed: %w", err))
		}
	}

	// seed categories
	mustExec(tx, `INSERT INTO categories (id, name, parent_id) VALUES
        (1, '电子产品', NULL),
        (2, '手机', 1),
        (3, '笔记本电脑', 1),
        (4, '配件', 1),
        (5, '食品饮料', NULL)
    `)

	// seed customers (5)
	mustExec(tx, `INSERT INTO customers (name, email, phone, city, province, registered_at, vip_level) VALUES
        ('张伟', 'zhangwei@test.com', '13800001001', '北京', '北京', '2024-01-05 10:23:00', 'gold'),
        ('李娜', 'lina@test.com', '13800001002', '上海', '上海', '2024-01-10 14:30:00', 'platinum'),
        ('王强', 'wangqiang@test.com', '13800001003', '广州', '广东', '2024-01-15 09:15:00', 'silver'),
        ('赵敏', 'zhaomin@test.com', '13800001004', '深圳', '广东', '2024-02-01 11:00:00', 'normal'),
        ('陈晓', 'chenxiao@test.com', '13800001005', '杭州', '浙江', '2024-02-10 16:45:00', 'gold')
    `)

	// seed products (6)
	mustExec(tx, `INSERT INTO products (id, name, category_id, price, cost, stock, status, created_at) VALUES
        (1, 'iPhone 15 Pro Max 256GB', 2, 9999.00, 6500.00, 120, 'on_sale', '2024-01-01 00:00:00'),
        (2, '华为 Mate 60 Pro', 2, 6999.00, 4200.00, 80, 'on_sale', '2024-01-05 00:00:00'),
        (3, 'MacBook Pro 14 M3', 3, 14999.00, 9800.00, 50, 'on_sale', '2024-01-01 00:00:00'),
        (4, 'AirPods Pro 2', 4, 1799.00, 900.00, 300, 'on_sale', '2024-01-01 00:00:00'),
        (5, '三只松鼠坚果礼盒', 5, 128.00, 65.00, 800, 'on_sale', '2024-01-10 00:00:00'),
        (6, '农夫山泉 550ml x 24', 5, 36.00, 15.00, 2000, 'on_sale', '2024-01-01 00:00:00')
    `)

	// seed orders (8) across months
	mustExec(tx, `INSERT INTO orders (order_no, customer_id, total_amount, discount_amount, pay_amount, status, payment_method, created_at, paid_at) VALUES
        ('ORD20240115001', 1, 9999.00, 500.00, 9499.00, 'delivered', 'wechat', '2024-01-15 10:30:00', '2024-01-15 10:31:00'),
        ('ORD20240116001', 2, 14999.00, 0.00, 14999.00, 'delivered', 'credit_card', '2024-01-16 14:20:00', '2024-01-16 14:21:00'),
        ('ORD20240301001', 3, 1799.00, 100.00, 1699.00, 'delivered', 'alipay', '2024-03-01 10:00:00', '2024-03-01 10:01:00'),
        ('ORD20240305001', 4, 128.00, 0.00, 128.00, 'delivered', 'wechat', '2024-03-05 11:30:00', '2024-03-05 11:31:00'),
        ('ORD20240401001', 5, 5999.00, 300.00, 5699.00, 'delivered', 'wechat', '2024-04-01 14:00:00', '2024-04-01 14:01:00'),
        ('ORD20240607001', 1, 2299.00, 200.00, 2099.00, 'delivered', 'wechat', '2024-06-07 14:00:00', '2024-06-07 14:01:00'),
        ('ORD20241111001', 2, 5999.00, 800.00, 5199.00, 'delivered', 'credit_card', '2024-11-11 00:05:00', '2024-11-11 00:06:00'),
        ('ORD20241212001', 3, 6999.00, 500.00, 6499.00, 'delivered', 'wechat', '2024-12-12 12:30:00', '2024-12-12 12:31:00')
    `)

	// seed order items
	mustExec(tx, `INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal) VALUES
        (1, 1, 1, 9999.00, 9999.00),
        (2, 3, 1, 14999.00, 14999.00),
        (3, 4, 1, 1799.00, 1799.00),
        (4, 5, 1, 128.00, 128.00),
        (5, 2, 1, 5999.00, 5999.00),
        (6, 4, 1, 1799.00, 1799.00),
        (6, 6, 5, 36.00, 180.00),
        (7, 2, 1, 5999.00, 5999.00),
        (8, 3, 1, 6999.00, 6999.00)
    `)

	if err := tx.Commit(); err != nil {
		panic(err)
	}

	fmt.Printf("SQLite demo DB generated at %s\n", dbPath)
	fmt.Println("tables: customers, categories, products, orders, order_items")
	fmt.Println("sample orders across months, with items and customers")
	fmt.Println("ready for read-only access (PRAGMA foreign_keys=ON)")
	_ = db.Close()
	time.Sleep(100 * time.Millisecond)
}
