#!/usr/bin/env python3
"""
Instalador do VendasPRO - Verifica dependências, cria banco e usuário de teste.
Uso: python installer.py

Funcionalidades:
  - Verifica Node.js, npm, package.json, node_modules
  - Instala dependências Python (psutil, bcrypt) automaticamente
  - Verifica variáveis de ambiente obrigatórias (JWT_SECRET, NODE_ENV)
  - Cria banco de dados com todas as tabelas
  - Cria usuários de teste (admin e caixa)
"""

import os
import sys
import subprocess
import sqlite3
import json
import time
import shutil
from pathlib import Path

# ─────────────────────────────────────────────────────────────────────────────
# Configurações
# ─────────────────────────────────────────────────────────────────────────────

PROJECT_ROOT = Path(__file__).parent.resolve()
DB_PATH = PROJECT_ROOT / "vendaspro.db"
NODE_MIN_VERSION = (18, 0, 0)
TEST_USER_EMAIL = "admin@vendaspro.com"
TEST_USER_PASSWORD = "admin123"

# Cores para output
RED = "\033[91m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
BOLD = "\033[1m"
RESET = "\033[0m"

def print_header(msg):
    print(f"\n{BOLD}{BLUE}{'='*60}{RESET}")
    print(f"{BOLD}{BLUE}{msg.center(60)}{RESET}")
    print(f"{BOLD}{BLUE}{'='*60}{RESET}\n")

def print_success(msg):
    print(f"{GREEN}✓ {msg}{RESET}")

def print_error(msg):
    print(f"{RED}✗ {msg}{RESET}")

def print_warning(msg):
    print(f"{YELLOW}⚠ {msg}{RESET}")

def print_info(msg):
    print(f"{BLUE}→ {msg}{RESET}")


# ─────────────────────────────────────────────────────────────────────────────
# Verificação de dependências
# ─────────────────────────────────────────────────────────────────────────────

def check_nodejs():
    """Verifica se Node.js está instalado na versão correta."""
    print_info("Verificando Node.js...")
    try:
        result = subprocess.run(["node", "--version"], capture_output=True, text=True, timeout=10)
        if result.returncode != 0:
            print_error("Node.js não está instalado ou não está no PATH.")
            return False
        
        version_str = result.stdout.strip().lstrip("v")
        parts = version_str.split(".")
        major = int(parts[0]) if len(parts) > 0 else 0
        minor = int(parts[1]) if len(parts) > 1 else 0
        patch = int(parts[2].split("-")[0]) if len(parts) > 2 else 0
        current_version = (major, minor, patch)
        
        if current_version < NODE_MIN_VERSION:
            print_error(f"Versão {version_str} é menor que a mínima {'.'.join(map(str, NODE_MIN_VERSION))}.")
            return False
        
        print_success(f"Node.js {version_str} encontrado (mínimo: {'.'.join(map(str, NODE_MIN_VERSION))})")
        return True
        
    except FileNotFoundError:
        print_error("Node.js não encontrado. Instale Node.js 18+ e adicione ao PATH.")
        return False
    except Exception as e:
        print_error(f"Erro ao verificar Node.js: {e}")
        return False


def check_npm():
    """Verifica npm. Se não estiver disponível mas node_modules existir, não é erro."""
    print_info("Verificando npm...")
    try:
        result = subprocess.run(["npm", "--version"], capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            print_success(f"npm {result.stdout.strip()} encontrado")
            return True
    except FileNotFoundError:
        pass  # npm não está instalado
    except Exception as e:
        print_warning(f"Erro ao verificar npm: {e}")
    
    print_info("npm não encontrado. Se node_modules já existir, não será necessário.")
    return False


def check_package_json():
    """Verifica se package.json existe e é válido."""
    print_info("Verificando package.json...")
    package_json = PROJECT_ROOT / "package.json"
    
    if not package_json.exists():
        print_error(f"package.json não encontrado em {PROJECT_ROOT}")
        return False
    
    try:
        with open(package_json, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        deps_count = len(data.get("dependencies", {}))
        print_success(f"package.json válido com {deps_count} dependências")
        return True
        
    except json.JSONDecodeError as e:
        print_error(f"package.json inválido: {e}")
        return False
    except Exception as e:
        print_error(f"Erro ao ler package.json: {e}")
        return False


def check_node_modules():
    """Verifica se node_modules existe e tem better-sqlite3."""
    print_info("Verificando node_modules...")
    node_modules = PROJECT_ROOT / "node_modules"
    better_sqlite3 = node_modules / "better-sqlite3"
    
    if node_modules.exists() and node_modules.is_dir() and better_sqlite3.exists():
        print_success("node_modules encontrado com better-sqlite3")
        return True
    
    if node_modules.exists() and node_modules.is_dir():
        print_warning("node_modules existe mas better-sqlite3 não está instalado.")
        return False
    
    print_warning("node_modules não encontrado.")
    return False


def install_dependencies():
    """Executa npm install para instalar as dependências."""
    print_info("Executando 'npm install'...")
    
    try:
        result = subprocess.run(
            ["npm", "install"],
            cwd=PROJECT_ROOT,
            capture_output=True,
            text=True,
            timeout=600
        )
        
        if result.returncode != 0:
            print_error("npm install falhou.")
            print_info("Saída de erro (últimos 500 chars):")
            print(result.stderr[-500:] if result.stderr else "Sem saída de erro")
            return False
        
        print_success("Dependências instaladas com sucesso!")
        return True
        
    except subprocess.TimeoutExpired:
        print_error("npm install demorou muito (timeout de 10 minutos).")
        return False
    except Exception as e:
        print_error(f"Erro ao instalar dependências: {e}")
        return False


def get_db_backup():
    """Cria backup do banco existente antes de recriar."""
    if DB_PATH.exists():
        timestamp = time.strftime("%Y%m%d-%H%M%S")
        backup_path = PROJECT_ROOT / f"vendaspro-{timestamp}.db.bak"
        try:
            shutil.copy2(DB_PATH, backup_path)
            print_info(f"Backup do banco existente: {backup_path}")
            return backup_path
        except Exception as e:
            print_warning(f"Não foi possível criar backup: {e}")
    return None


# ─────────────────────────────────────────────────────────────────────────────
# Instalação de dependências Python
# ─────────────────────────────────────────────────────────────────────────────

def install_python_deps():
    """
    Verifica e instala as dependências Python necessárias: psutil e bcrypt.
    """
    print_info("Verificando dependências Python (psutil, bcrypt)...")
    
    # Verificar psutil
    try:
        import psutil
        print_success("psutil já disponível")
    except ImportError:
        print_info("Instalando psutil...")
        try:
            subprocess.run([sys.executable, "-m", "pip", "install", "psutil"],
                          capture_output=True, text=True, timeout=120, check=True)
            import psutil
            print_success("psutil instalado com sucesso")
        except Exception as e:
            print_error(f"Falha ao instalar psutil: {e}")
            return False
    
    # Verificar bcrypt
    try:
        import bcrypt
        print_success("bcrypt já disponível")
    except ImportError:
        print_info("Instalando bcrypt...")
        try:
            subprocess.run([sys.executable, "-m", "pip", "install", "bcrypt"],
                          capture_output=True, text=True, timeout=120, check=True)
            import bcrypt
            print_success("bcrypt instalado com sucesso")
        except Exception as e:
            print_error(f"Falha ao instalar bcrypt: {e}")
            return False
    
    return True


# ─────────────────────────────────────────────────────────────────────────────
# Verificação de variáveis de ambiente
# ─────────────────────────────────────────────────────────────────────────────

def check_env_vars():
    """
    Verifica as variáveis de ambiente necessárias para o funcionamento do sistema.
    """
    print_header("Verificando variáveis de ambiente")
    
    required_vars = {
        "JWT_SECRET": "Segredo para assinatura de tokens JWT (deve ser uma string longa e aleatória)",
        "NODE_ENV": "Ambiente de execução (development ou production)"
    }
    
    optional_vars = {
        "DB_PATH": "Caminho do banco de dados (padrão: vendaspro.db na raiz do projeto)",
        "PORT": "Porta do servidor backend (padrão: 3001)",
        "FRONTEND_URL": "URL do frontend para CORS (padrão: http://localhost:5173)",
        "TERMINAL_ID": "ID do terminal/PDV para operações de caixa (padrão: PDV-01)"
    }
    
    missing_required = []
    configured_optional = []
    
    for var, desc in required_vars.items():
        value = os.environ.get(var)
        if value:
            masked = value[:3] + "***" if len(value) > 3 else "***"
            print_success(f"{var} configurado ({masked})")
        else:
            print_error(f"{var} não configurado — {desc}")
            missing_required.append(var)
    
    for var, desc in optional_vars.items():
        value = os.environ.get(var)
        if value:
            print_success(f"{var} configurado: {value[:50]}{'...' if len(value) > 50 else ''}")
            configured_optional.append(var)
        else:
            print_info(f"{var} não configurado (padrão será usado) — {desc}")
    
    if missing_required:
        print_header("Variáveis obrigatórias faltando")
        print_info("Configure-as antes de iniciar o servidor:")
        print_info("")
        print(f"  {BOLD}Opção 1 — Variáveis de ambiente temporárias:{RESET}")
        for var in missing_required:
            print(f"    set {var}=<valor> && npm start  (Windows CMD)")
            print(f"    $env:{var}=\"<valor>\"; npm start  (PowerShell)")
            print(f"    JWT_SECRET=<valor> NODE_ENV=development npm start  (Git Bash)")
        print_info("")
        print(f"  {BOLD}Opção 2 — Arquivo .env (recomendado):{RESET}")
        print_info("    Crie um arquivo chamado .env na raiz do projeto com:")
        print_info("    JWT_SECRET=sua_chave_secreta_aqui_muito_longa")
        print_info("    NODE_ENV=development")
        print_info("    PORT=3001")
        print_info("    FRONTEND_URL=http://localhost:5173")
        print_info("    TERMINAL_ID=PDV-01")
        print_info("")
        print_info("    O arquivo .env deve ser carregado antes de iniciar o servidor.")
        print_info("    Exemplo: npm run dev (se usar dotenv no package.json)")
        print_info("")
        return False
    
    return True


# ─────────────────────────────────────────────────────────────────────────────
# Banco de dados
# ─────────────────────────────────────────────────────────────────────────────

def get_db_lock_pid():
    """
    Tenta identificar o PID que está travando o banco.
    Retorna (pid, process_name) ou (None, None) se não conseguir.
    """
    try:
        import psutil
    except ImportError:
        return None, None
    
    pids = []
    for proc in psutil.process_iter(['pid', 'name', 'open_files']):
        try:
            open_files = proc.info.get('open_files')
            if open_files is None:
                continue
            for f in open_files:
                try:
                    if f.path and str(DB_PATH).lower() in f.path.lower():
                        pids.append((proc.info['pid'], proc.info['name']))
                except Exception:
                    pass
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass
    
    if pids:
        return pids[0]
    return None, None


def release_db_lock():
    """Tenta matar o processo que está bloqueando o banco."""
    pid, name = get_db_lock_pid()
    if pid:
        print_warning(f"Processo PID {pid} ({name}) está travando o banco. Tentando finalizar...")
        try:
            import psutil
            proc = psutil.Process(pid)
            proc.terminate()
            proc.wait(timeout=5)
            print_success(f"Processo PID {pid} finalizado.")
            return True
        except psutil.TimeoutExpired:
            print_warning(f"Processo PID {pid} não responde. Forçando...")
            try:
                proc.kill()
                print_success(f"Processo PID {pid} morto forçosamente.")
                return True
            except Exception as e:
                print_error(f"Não foi possível matar o processo: {e}")
                return False
        except Exception as e:
            print_error(f"Erro ao finalizar processo: {e}")
            return False
    return False


def create_database():
    """
    Cria o banco de dados com todas as tabelas usando esquema idêntico ao do backend.
    """
    print_info("Criando banco de dados...")
    
    # Verifica se há processo travando o banco
    lock_pid, lock_name = get_db_lock_pid()
    if lock_pid:
        print_warning(f"O banco de dados está sendo usado pelo processo PID {lock_pid} ({lock_name}).")
        print_info("Para prosseguir, você pode:")
        print_info(f"  1. Finalizar o processo manualmente (taskkill /PID {lock_pid} /F)")
        print_info("  2. Parar o servidor Node.js")
        print_info("  3. Permitir que o instalador tente finalizar automaticamente")
        
        try:
            resp = input(f"{YELLOW}Finalizar processo {lock_pid} ({lock_name}) agora? (s/n): {RESET}")
            if resp.lower() in ['s', 'sim', 'y', 'yes']:
                if not release_db_lock():
                    print_error("Não foi possível liberar o banco. Abortando.")
                    return False
            else:
                print_error("Operação cancelada pelo usuário.")
                return False
        except EOFError:
            print_error("Entrada não disponível. Abortando.")
            return False
    else:
        print_info("Verificando se o banco está em uso...")
    
    # Backup se banco existir
    get_db_backup()
    
    try:
        # Remove banco existente para criar do zero
        if DB_PATH.exists():
            try:
                DB_PATH.unlink()
                print_info("Banco anterior removido.")
            except OSError as e:
                if e.winerror == 32:  # Sharing violation
                    print_warning("Não foi possível remover o banco enquanto estiver em uso.")
                    if lock_pid:
                        release_db_lock()
                    try:
                        DB_PATH.unlink()
                        print_info("Banco anterior removido após liberação.")
                    except OSError:
                        print_error("Banco ainda travado. Tente desligar o servidor e repetir.")
                        return False
                else:
                    raise
        
        conn = sqlite3.connect(str(DB_PATH))
        cursor = conn.cursor()
        
        # Habilita WAL mode e foreign keys
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        
        # ── Tabelas ────────────────────────────────────────────────────────
        
        cursor.execute("""
            CREATE TABLE users (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'caixa',
                active INTEGER NOT NULL DEFAULT 1
            )
        """)
        
        cursor.execute("""
            CREATE TABLE categories (
                id TEXT PRIMARY KEY,
                code TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                parentId TEXT,
                description TEXT,
                marginPercent REAL DEFAULT 0,
                active INTEGER DEFAULT 1
            )
        """)
        
        cursor.execute("""
            CREATE TABLE brands (
                id TEXT PRIMARY KEY,
                code TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                active INTEGER DEFAULT 1
            )
        """)
        
        cursor.execute("""
            CREATE TABLE suppliers (
                id TEXT PRIMARY KEY,
                code TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                cnpjCpf TEXT NOT NULL,
                phone TEXT NOT NULL,
                email TEXT,
                active INTEGER DEFAULT 1
            )
        """)
        
        cursor.execute("""
            CREATE TABLE products (
                id TEXT PRIMARY KEY,
                code TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                barcode TEXT NOT NULL,
                sku TEXT NOT NULL,
                categoryId TEXT,
                category TEXT NOT NULL,
                brandId TEXT,
                brand TEXT,
                supplierId TEXT,
                unit TEXT NOT NULL DEFAULT 'UN',
                price REAL NOT NULL DEFAULT 0,
                costPrice REAL NOT NULL DEFAULT 0,
                marginPercent REAL DEFAULT 0,
                stock INTEGER NOT NULL DEFAULT 0,
                minStock INTEGER NOT NULL DEFAULT 0,
                idealStock INTEGER NOT NULL DEFAULT 0,
                maxStock INTEGER NOT NULL DEFAULT 0,
                allowNegative INTEGER NOT NULL DEFAULT 0,
                active INTEGER NOT NULL DEFAULT 1,
                iconType TEXT NOT NULL DEFAULT 'general',
                colorTheme TEXT,
                FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE SET NULL,
                FOREIGN KEY (brandId) REFERENCES brands(id) ON DELETE SET NULL,
                FOREIGN KEY (supplierId) REFERENCES suppliers(id) ON DELETE SET NULL
            )
        """)
        
        cursor.execute("""
            CREATE TABLE customers (
                id TEXT PRIMARY KEY,
                code TEXT UNIQUE,
                name TEXT NOT NULL,
                cpf TEXT,
                email TEXT,
                phone TEXT,
                creditLimit REAL NOT NULL DEFAULT 0,
                currentDebt REAL NOT NULL DEFAULT 0,
                creditStatus TEXT NOT NULL DEFAULT 'liberado',
                dueDays INTEGER DEFAULT 30,
                active INTEGER DEFAULT 1
            )
        """)
        
        cursor.execute("""
            CREATE TABLE sales (
                id TEXT PRIMARY KEY,
                code TEXT UNIQUE NOT NULL,
                timestamp TEXT NOT NULL,
                terminal TEXT NOT NULL DEFAULT 'PDV-01',
                operator TEXT NOT NULL,
                subtotal REAL NOT NULL DEFAULT 0,
                discount REAL NOT NULL DEFAULT 0,
                total REAL NOT NULL DEFAULT 0,
                paymentMethod TEXT NOT NULL,
                customerId TEXT,
                customerName TEXT DEFAULT 'Consumidor Final',
                customerCpf TEXT,
                status TEXT NOT NULL DEFAULT 'concluida',
                cancelledAt TEXT,
                cancelReason TEXT,
                cashRegisterId TEXT,
                FOREIGN KEY (customerId) REFERENCES customers(id) ON DELETE SET NULL
            )
        """)
        
        cursor.execute("""
            CREATE TABLE sale_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                saleId TEXT NOT NULL,
                productId TEXT NOT NULL,
                productName TEXT NOT NULL,
                quantity INTEGER NOT NULL DEFAULT 1,
                unitPrice REAL NOT NULL DEFAULT 0,
                originalPrice REAL NOT NULL DEFAULT 0,
                discount REAL NOT NULL DEFAULT 0,
                total REAL NOT NULL DEFAULT 0,
                FOREIGN KEY (saleId) REFERENCES sales(id) ON DELETE CASCADE,
                FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE
            )
        """)
        
        cursor.execute("""
            CREATE TABLE stock_movements (
                id TEXT PRIMARY KEY,
                code TEXT UNIQUE NOT NULL,
                productId TEXT NOT NULL,
                productName TEXT NOT NULL,
                type TEXT NOT NULL,
                operation TEXT NOT NULL DEFAULT 'saida',
                quantity INTEGER NOT NULL DEFAULT 0,
                previousStock INTEGER NOT NULL DEFAULT 0,
                newStock INTEGER NOT NULL DEFAULT 0,
                unitCost REAL NOT NULL DEFAULT 0,
                totalValue REAL NOT NULL DEFAULT 0,
                reason TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                operator TEXT NOT NULL,
                operatorId TEXT,
                referenceDocument TEXT,
                FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE
            )
        """)
        
        cursor.execute("""
            CREATE TABLE cash_registers (
                id TEXT PRIMARY KEY,
                code TEXT,
                openedAt TEXT NOT NULL,
                closedAt TEXT,
                openingBalance REAL DEFAULT 0,
                balance REAL DEFAULT 0,
                salesTotal REAL DEFAULT 0,
                closingBalance REAL DEFAULT 0,
                countedBalance REAL DEFAULT 0,
                difference REAL DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'aberto',
                operator TEXT NOT NULL,
                operatorId TEXT,
                closedBy TEXT
            )
        """)
        
        cursor.execute("""
            CREATE TABLE cash_movements (
                id TEXT PRIMARY KEY,
                cashRegisterId TEXT NOT NULL,
                type TEXT NOT NULL,
                amount REAL NOT NULL DEFAULT 0,
                description TEXT,
                reason TEXT,
                timestamp TEXT NOT NULL,
                operator TEXT,
                operatorId TEXT,
                referenceId TEXT,
                FOREIGN KEY (cashRegisterId) REFERENCES cash_registers(id) ON DELETE CASCADE
            )
        """)
        
        cursor.execute("""
            CREATE TABLE promotions (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                productId TEXT NOT NULL,
                discountType TEXT NOT NULL DEFAULT 'percent',
                discountValue REAL NOT NULL DEFAULT 0,
                minQuantity INTEGER NOT NULL DEFAULT 1,
                startDate TEXT NOT NULL,
                endDate TEXT NOT NULL,
                active INTEGER NOT NULL DEFAULT 1,
                FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE
            )
        """)
        
        cursor.execute("""
            CREATE TABLE company_settings (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                name TEXT NOT NULL DEFAULT 'VendasPRO',
                tradeName TEXT NOT NULL DEFAULT 'Minha Loja',
                cnpj TEXT NOT NULL DEFAULT '',
                ie TEXT NOT NULL DEFAULT '',
                address TEXT NOT NULL DEFAULT '',
                phone TEXT NOT NULL DEFAULT '',
                email TEXT NOT NULL DEFAULT '',
                pixKey TEXT,
                pixKeyType TEXT,
                pixBeneficiaryName TEXT,
                pixCity TEXT,
                defaultMarginPercent REAL DEFAULT 40,
                cardFeePercent REAL DEFAULT 3,
                withdrawalLimit REAL DEFAULT 0
            )
        """)
        
        cursor.execute("""
            CREATE TABLE sequences (
                prefix TEXT PRIMARY KEY,
                current_value INTEGER NOT NULL DEFAULT 0
            )
        """)
        
        # ── Índices ───────────────────────────────────────────────────────
        
        cursor.execute("CREATE INDEX idx_products_barcode ON products(barcode)")
        cursor.execute("CREATE INDEX idx_products_active ON products(active)")
        
        # ── Dados iniciais ────────────────────────────────────────────────
        
        sequences = [
            ('USR', 0), ('CAT', 0), ('MRC', 0), ('FOR', 0),
            ('PRD', 0), ('CLI', 0), ('VND', 0), ('MOV', 0),
            ('REG', 0), ('PROM', 0), ('CMP', 0)
        ]
        cursor.executemany(
            "INSERT OR REPLACE INTO sequences (prefix, current_value) VALUES (?, ?)",
            sequences
        )
        
        cursor.execute("""
            INSERT INTO customers (id, code, name, creditLimit, currentDebt, creditStatus, dueDays)
            VALUES ('cons-final', 'CLI-000000', 'Consumidor Final (Sem CPF)', 0, 0, 'liberado', 0)
        """)
        
        cursor.execute("""
            INSERT INTO company_settings (id, name, tradeName)
            VALUES (1, 'VendasPRO', 'Minha Loja')
        """)
        
        # ── Triggers de integridade ───────────────────────────────────────
        
        guarded_tables = ['sales', 'sale_items', 'products', 'customers', 
                          'stock_movements', 'cash_registers', 'cash_movements']
        
        for table in guarded_tables:
            cursor.execute(f"""
                CREATE TRIGGER IF NOT EXISTS trg_guard_{table}
                BEFORE DELETE ON {table}
                BEGIN
                    SELECT RAISE(ABORT, 'Integridade: exclusão direta não é permitida (use desativar/cancelar)');
                END
            """)
        
        conn.commit()
        conn.close()
        
        print_success(f"Banco de dados criado em {DB_PATH}")
        return True
        
    except sqlite3.Error as e:
        print_error(f"Erro de SQLite: {e}")
        return False
    except Exception as e:
        print_error(f"Erro inesperado: {e}")
        return False


def create_test_user(password=None):
    """
    Cria usuários de teste (admin e caixa) com senha específica.
    """
    if password is None:
        password = TEST_USER_PASSWORD
    
    print_info("Criando usuários de teste...")
    
    try:
        # Verifica se já existem usuários
        conn = sqlite3.connect(str(DB_PATH))
        cursor = conn.cursor()
        
        cursor.execute("SELECT COUNT(*) FROM users")
        count = cursor.fetchone()[0]
        
        if count > 0:
            print_warning(f"Já existem {count} usuário(s) no banco. Pulando criação de teste.")
            conn.close()
            return True
        
        # Para criar o hash de senha, precisamos de bcrypt.
        # Como o backend usa better-sqlite3 + bcrypt, mas aqui estamos em Python puro,
        # vamos criar o hash usando bcrypt se disponível, ou SHA256 como fallback.
        try:
            import bcrypt
            salt = bcrypt.gensalt(rounds=10)
            admin_hash = bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')
            caixa_senha = f"caixa@{password}"
            caixa_hash = bcrypt.hashpw(caixa_senha.encode('utf-8'), salt).decode('utf-8')
        except ImportError:
            # Fallback: hash simples (não é compatível com o backend, mas permite teste)
            import hashlib
            admin_hash = hashlib.sha256(password.encode('utf-8')).hexdigest()
            caixa_senha = f"caixa@{password}"
            caixa_hash = hashlib.sha256(caixa_senha.encode('utf-8')).hexdigest()
            print_warning("bcrypt não disponível em Python. Usando hash SHA256 para teste.")
            print_warning("Para produção, instale bcrypt: pip install bcrypt")
        
        cursor.execute("""
            INSERT INTO users (id, name, email, password, role, active)
            VALUES ('usr-001', 'Admin', ?, ?, 'admin', 1)
        """, (TEST_USER_EMAIL, admin_hash))
        
        cursor.execute("""
            INSERT INTO users (id, name, email, password, role, active)
            VALUES ('usr-002', 'Caixa', ?, ?, 'caixa', 1)
        """, (f"caixa@{TEST_USER_EMAIL}", caixa_hash))
        
        conn.commit()
        conn.close()
        
        print_success(f"Usuários de teste criados:")
        print_info(f"  Admin: {TEST_USER_EMAIL} / {password}")
        print_info(f"  Caixa: caixa@{TEST_USER_EMAIL} / {password}")
        return True
        
    except Exception as e:
        print_error(f"Erro ao criar usuários de teste: {e}")
        return False


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

def main():
    print(f"""
{BOLD}VendasPRO - Instalador de Configuração{RESET}
{'='*50}
 Projeto: VendasPRO (Sistema de PDV e Gestão)
 Versão: 1.2.0
{'='*50}
    """)
    
    # ── PASSO 0: Instalar dependências Python ────────────────────────────
    
    print_header("PASSO 0: Verificando dependências Python")
    
    if not install_python_deps():
        print_warning("Algumas dependências Python falharam na instalação.")
        print_info("Continuando mesmo assim...")
    
    # ── PASSO 1: Verificar dependências do Node ─────────────────────────
    
    print_header("PASSO 1: Verificando dependências do Node")
    
    deps_ok = True
    deps_ok = check_nodejs() and deps_ok
    npm_ok = check_npm()  # npm é opcional se node_modules já existir
    deps_ok = check_package_json() and deps_ok
    deps_ok = check_node_modules() or deps_ok
    
    if not deps_ok:
        print_header("Instalação interrompida")
        print_error("Dependências não satisfeitas.")
        print_info("Requisitos:")
        print_info(f"  - Node.js {'.'.join(map(str, NODE_MIN_VERSION))}+")
        print_info("  - package.json no diretório do projeto")
        print_info("  - node_modules com better-sqlite3 (ou npm para instalar)")
        return 1
    
    if not check_node_modules() and npm_ok:
        print_info("node_modules não encontrado. Instalando...")
        if not install_dependencies():
            print_error("Falha ao instalar dependências.")
            return 1
    
    # ── PASSO 2: Verificar variáveis de ambiente ────────────────────────
    
    print_header("PASSO 2: Verificando variáveis de ambiente")
    
    check_env_vars()  # Apenas informa, não bloqueia
    
    # ── PASSO 3: Criar banco de dados ────────────────────────────────────
    
    print_header("PASSO 3: Criando banco de dados")
    
    if not create_database():
        print_error("Falha ao criar banco de dados.")
        return 1
    
    # ── PASSO 4: Criar usuário de teste ──────────────────────────────────
    
    print_header("PASSO 4: Criando usuário de teste")
    
    if not create_test_user():
        print_error("Falha ao criar usuário de teste.")
        return 1
    
    # ── Conclusão ────────────────────────────────────────────────────────
    
    print_header("Instalação concluída com sucesso!")
    print(f"""
{GREEN}✓ Sistema pronto para uso{RESET}

{BOLD}Próximos passos:{RESET}
  1. Configure as variáveis de ambiente (veja o relatório acima):
     - JWT_SECRET: Segredo para assinatura de tokens JWT
     - NODE_ENV: development ou production
     - DB_PATH: Caminho do banco (opcional, padrão: vendaspro.db)
     - PORT: Porta do servidor (opcional, padrão: 3001)
     - FRONTEND_URL: URL do frontend (opcional, padrão: http://localhost:5173)
     - TERMINAL_ID: ID do terminal (opcional, padrão: PDV-01)

  2. Inicie o servidor:
     {BOLD}npm run dev{RESET}  (modo desenvolvimento)
     ou
     {BOLD}npm start{RESET}   (modo produção)

  3. Acesse o sistema:
     Frontend: http://localhost:5173
     Backend:  http://localhost:3001

{BOLD}Usuários de teste:{RESET}
  Admin: {TEST_USER_EMAIL} / {TEST_USER_PASSWORD}
  Caixa: caixa@{TEST_USER_EMAIL} / {TEST_USER_PASSWORD}

{GREEN}✓ Instalação finalizada!{RESET}
    """)
    return 0


if __name__ == "__main__":
    sys.exit(main())
