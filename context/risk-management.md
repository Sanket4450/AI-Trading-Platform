| Control                 | Specification                                                                                            |
| ----------------------- | -------------------------------------------------------------------------------------------------------- |
| Risk per trade          | 0.5% of current account equity                                                                           |
| Daily loss limit        | 1% of current account equity, including realized and open-position losses                                |
| Position limit          | One open position                                                                                        |
| Entry limit             | Two new trades per day                                                                                   |
| Capital constraint      | Do not depend on leverage or exceed available capital                                                    |
| Stop-loss execution     | Use a broker-supported protective exit order; verify its actual exchange and order-type behaviour        |
| Failed protective order | Disable further entries and invoke a predefined recovery procedure                                       |
| Market-data failure     | Stop generating new signals                                                                              |
| Uncertain order state   | Reconcile with Upstox before permitting further orders                                                   |
| Daily loss-limit breach | Flatten according to the emergency exit policy and disable new entries for that session                  |
| Configuration changes   | Version and snapshot settings per session; risk-increasing changes take effect from a subsequent session |
| Kill switch             | Independently disable new trading and support emergency order/position handling                          |
