const foo = true;
if (foo) {
  const bar = await Promise.resolve(1);
  console.log(bar);
}
