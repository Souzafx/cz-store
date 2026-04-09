/* ============================================
   storage.js — Camada de persistência (localStorage)
   Todos os dados ficam salvos no próprio navegador.
   ============================================ */

const STORAGE_KEY = "cz_products_v1";

const Storage = {
  /** Retorna todos os produtos salvos. */
  getAll() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error("Erro ao ler storage:", e);
      return [];
    }
  },

  /** Salva a lista inteira (substitui). */
  saveAll(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  },

  /** Adiciona um novo produto (gera id automaticamente). */
  add(product) {
    const list = this.getAll();
    product.id = Date.now().toString() + Math.random().toString(36).slice(2, 7);
    product.createdAt = new Date().toISOString();
    list.push(product);
    this.saveAll(list);
    return product;
  },

  /** Atualiza um produto existente por id. */
  update(id, data) {
    const list = this.getAll();
    const i = list.findIndex(p => p.id === id);
    if (i === -1) return null;
    list[i] = { ...list[i], ...data, id };
    this.saveAll(list);
    return list[i];
  },

  /** Remove um produto por id. */
  remove(id) {
    const list = this.getAll().filter(p => p.id !== id);
    this.saveAll(list);
  },

  /** Busca um produto por id. */
  get(id) {
    return this.getAll().find(p => p.id === id);
  },

  /** Limpa tudo (use com cuidado). */
  clear() {
    localStorage.removeItem(STORAGE_KEY);
  }
};
