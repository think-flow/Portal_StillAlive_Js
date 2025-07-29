class DoublyLinkedListNode {
  constructor(value) {
    this.value = value;
    this.prev = null;
    this.next = null;
  }
}

class DoublyLinkedList {
	#head;
	#tail;
	#count;
  constructor() {
    this.#head = null;
    this.#tail = null;
    this.#count = 0;
  }

  // 在链表头部插入节点
  prepend(value) {
    const newNode = new DoublyLinkedListNode(value);
    
    if (this.#head === null) {
      this.#head = newNode;
      this.#tail = newNode;
    } else {
      newNode.next = this.#head;
      this.#head.prev = newNode;
      this.#head = newNode;
    }
    
    this.#count++;
    return this;
  }

  // 在链表尾部插入节点
  append(value) {
    const newNode = new DoublyLinkedListNode(value);
    
    if (this.#head === null) {
      this.#head = newNode;
      this.#tail = newNode;
    } else {
      newNode.prev = this.#tail;
      this.#tail.next = newNode;
      this.#tail = newNode;
    }
    
    this.#count++;
    return this;
  }

  // 从头部移除节点
  removeFirst() {
    if (this.#head === null) return null;
    
    const removedNode = this.#head;
    
    if (this.#head === this.#tail) {
      this.#head = null;
      this.#tail = null;
    } else {
      this.#head = this.#head.next;
      this.#head.prev = null;
    }
    
    this.#count--;
    return removedNode.value;
  }

  // 从尾部移除节点
  removeLast() {
    if (this.#tail === null) return null;
    
    const removedNode = this.#tail;
    
    if (this.#head === this.#tail) {
      this.#head = null;
      this.#tail = null;
    } else {
      this.#tail = this.#tail.prev;
      this.#tail.next = null;
    }
    
    this.#count--;
    return removedNode.value;
  }

  // 获取元素数量
  get count() {
    return this.#count;
  }
  
  get head(){
	  return this.#head;
  }
  
  get tail(){
	  return this.#tail;
  }

  // 使链表可迭代
  *[Symbol.iterator]() {
    let current = this.#head;
    while (current !== null) {
      yield current.value;
      current = current.next;
    }
  }
}

