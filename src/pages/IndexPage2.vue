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
import {sendMessageToWorker} from "src/database/SQLiteServiceV2";

const users = ref<any[]>([]);
const orders = ref<any[]>([]);
const userOrders = ref<any[]>([]);

onMounted(() => {
  sendMessageToWorker("init").then(() => {
    fetchUsers2()
    fetchOrder2()
    fetchUserOrders2()
  })
})

const addUser2 = () => {
  const name = `User ${Math.floor(Math.random() * 100)}`;
  const age = Math.floor(Math.random() * 50) + 20;
  sendMessageToWorker("execute", {
    sql: `
      INSERT INTO users (name, age)
      VALUES (?, ?);
    `,
    params: [name, age],
  });
  fetchUsers2()
  fetchUserOrders2()
}

const addOrder2 = () => {
  const userId = Math.floor(Math.random() * 3) + 1;
  const amount = (Math.random() * 100).toFixed(2);
  sendMessageToWorker('execute', {
    sql : `
    INSERT INTO orders (user_id, amount)
    VALUES (?, ?);
  `, params : [userId, amount]
  })
  fetchOrder2()
  fetchUserOrders2()
};

const fetchUsers2 = async () => {
  sendMessageToWorker('query',{
    sql: "SELECT * FROM users",
    params: [],
  }).then((res : any)=>{
    console.log(res)
    users.value = res.map((row: any) => ({
      id: row[0],
      name: row[1],
      age: row[2],
    }));
  })
};

const fetchOrder2 = async () => {
  sendMessageToWorker('query',{
    sql: "SELECT * FROM orders",
    params: [],
  }).then((res : any)=>{
    console.log(res)
    orders.value = res.map((row: any) => ({
      id: row[0],
      user_id: row[1],
      amount: row[2],
    }));
  })
};

const fetchUserOrders2 = async () => {
  sendMessageToWorker('query',{
    sql: "SELECT users.id AS user_id, users.name, users.age, orders.amount\n    FROM users\n    JOIN orders ON users.id = orders.user_id",
    params: [],
  }).then((res : any)=>{
    userOrders.value = res.map((row: any) => ({
      user_id: row[0],
      name: row[1],
      age: row[2],
      amount: row[3],
    }));
  })
};
</script>
