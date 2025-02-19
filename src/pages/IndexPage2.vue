<template>
  <div>
    <h1>SQLite 表和视图显示示例</h1>
    <button @click="addUser2">添加用户</button>
    <button @click="addOrder2">添加订单</button>

    <h2>Users 表</h2>
    <ul>
      <li v-for="user in users" :key="user.id">
        用户 ID: {{ user.id }}, 名称: {{ user.name }}, 年龄: {{ user.age }}
      </li>
    </ul>

    <h2>Orders 表</h2>
    <ul>
      <li v-for="order in orders" :key="order.id">
        订单 ID: {{ order.id }}, 用户 ID: {{ order.user_id }}, 金额: {{ order.amount }}
      </li>
    </ul>

    <h2>User Orders 视图</h2>
    <ul>
      <li v-for="entry in userOrders" :key="entry.user_id">
        用户名: {{ entry.name }} ({{ entry.age }} 岁) - 订单金额: {{ entry.amount }}
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import {onMounted, ref} from "vue";

const users = ref<any[]>([]);
const orders = ref<any[]>([]);
const userOrders = ref<any[]>([]);
const worker = new Worker(new URL("src/database/SQLiteServiceV3.ts",import.meta.url));

worker.onmessage = (event : any) => {
  const {type, result, error} = event.data;
  if (type === "init") {
    console.log(result);
  } else if (type === "execute") {
    console.log(result);
  } else if (type === "query") {
    console.log(result);
  } else if (type === "error") {
    console.error(error);
  }
}

onMounted(() => {
  worker.postMessage({
    type: "init"
  })
})

const addUser2 = () => {
  worker.postMessage({
    type: "execute",
    payload: {
      sql: "INSERT INTO users (name, age) VALUES (?, ?)",
      params: ["test", "66"],
    },
  });
}

const addOrder2 = () => {
  worker.postMessage({
    type: "query",
    payload: {
      sql: "SELECT * FROM users",
      params: [],
    },
  });
};

const fetchUsers2 = async () => {
  worker.postMessage({
    type: "query",
    payload: {
      sql: "SELECT * FROM users",
      params: [],
    },
  });
};

const fetchOrder2 = async () => {
  worker.postMessage({
    type: "query",
    payload: {
      sql: "SELECT * FROM orders",
      params: [],
    },
  });
};

const fetchUserOrders2 = async () => {
  worker.postMessage({
    type: "query",
    payload: {
      sql: "SELECT users.id AS user_id, users.name, users.age, orders.amount\n    FROM users\n    JOIN orders ON users.id = orders.user_id",
      params: [],
    },
  });
};
</script>
